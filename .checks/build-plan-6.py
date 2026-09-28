# Monta o plano da Fase 6 a partir do modelo, com o código verificado do protótipo.
# Uso (na raiz do branch por tarefa, no último commit): python .checks/build-plan-6.py <modelo.md> <saída.md>
#   @@FILE <caminho>@@   o arquivo inteiro, como está agora
#   @@EDITS <caminho>@@  os trechos "Troque / por" que levam a base (BASE) ao arquivo de agora
#   @@OUT <nome>@@       a saída guardada em .checks/out/<nome>.txt
import difflib
import re
import subprocess
import sys

# O último commit do branch da fase antes do código: o ponto de partida de quem executa o plano.
BASE = 'dc1dcd7'
LANG = {
    '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.mjs': 'js', '.sh': 'bash', '.xml': 'xml',
    '.css': 'css', '.json': 'json', '.md': 'markdown'
}


def read(path):
    with open(path, encoding='utf-8') as file:
        return file.read()


def base(path):
    return subprocess.run(
        ['git', 'show', f'{BASE}:{path}'], capture_output=True, check=True
    ).stdout.decode('utf-8')


def fence(path, text):
    lang = next((lang for ext, lang in LANG.items() if path.endswith(ext)), '')
    # Um trecho com ``` dentro (um bloco de código da SPEC) pede uma cerca mais longa.
    longest = max((len(run) for run in re.findall(r'`{3,}', text)), default=2)
    ticks = '`' * max(3, longest + 1)
    return f'{ticks}{lang}\n{text.rstrip()}\n{ticks}'


def edits(path):
    old = base(path)
    new = read(path)
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    for context in range(2, 12):
        groups = list(
            difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False).get_grouped_opcodes(
                context
            )
        )
        chunks = []
        for group in groups:
            i1, i2 = group[0][1], group[-1][2]
            j1, j2 = group[0][3], group[-1][4]
            chunks.append((''.join(old_lines[i1:i2]), ''.join(new_lines[j1:j2])))
        if all(old.count(before) == 1 for before, _ in chunks):
            break
    else:
        raise SystemExit(f'trecho repetido em {path}')
    blocks = []
    for before, after in chunks:
        # Trechos soltos não passam pelo Prettier: ele os reindentaria, e eles deixariam de
        # bater com o arquivo.
        ignore = '<!-- prettier-ignore -->'
        blocks.append(
            f'Troque:\n\n{ignore}\n{fence(path, before)}\n\npor:\n\n{ignore}\n{fence(path, after)}'
        )
    return '\n\n'.join(blocks)


def fill(match):
    kind, path = match.group(1).split()
    if kind == 'FILE':
        return fence(path, read(path))
    if kind == 'EDITS':
        return edits(path)
    if kind == 'OUT':
        return fence('', read(f'.checks/out/{path}.txt'))
    raise SystemExit(f'marcador desconhecido: {kind}')


template, output = sys.argv[1:]
plan = re.sub(r'@@(\w+ [^@]+)@@', fill, read(template))
with open(output, 'w', encoding='utf-8', newline='\n') as file:
    file.write(plan)
print(f'{output}: {plan.count(chr(10))} linhas')

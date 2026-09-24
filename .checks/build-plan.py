# Monta o plano da Fase 4 a partir do modelo, com o código verificado do protótipo.
# Uso (na raiz do protótipo): python .checks/build-plan.py <modelo.md> <saída.md>
import difflib
import re
import subprocess
import sys

BASE_BRANCH = '549035b'
LANG = {'.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.mjs': 'js', '.sh': 'bash', '.xml': 'xml'}

NOTICE_OLD = '<span className="flex-1">Edição recusada: {notice}</span>'
NOTICE_NEW = '<span className="flex-1">{notice}</span>'


def read(path):
    with open(path, encoding='utf-8') as file:
        return file.read()


def base(path, variant):
    text = subprocess.run(
        ['git', 'show', f'{BASE_BRANCH}:{path}'], capture_output=True, check=True
    ).stdout.decode('utf-8')
    if variant == 'depois-da-tarefa-3':
        assert text.count(NOTICE_OLD) == 1
        text = text.replace(NOTICE_OLD, NOTICE_NEW)
    return text


def fence(path, text):
    lang = next((lang for ext, lang in LANG.items() if path.endswith(ext)), '')
    return f'```{lang}\n{text.rstrip()}\n```'


def edits(path, variant):
    old = base(path, variant)
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
    kind, path, *rest = match.group(1).split()
    variant = rest[0] if rest else None
    if kind == 'FILE':
        return fence(path, read(path))
    if kind == 'EDITS':
        return edits(path, variant)
    if kind == 'OUT':
        return fence('', read(f'.checks/out/{path}.txt'))
    raise SystemExit(f'marcador desconhecido: {kind}')


template, output = sys.argv[1:]
plan = re.sub(r'@@(\w+ [^@]+)@@', fill, read(template))
with open(output, 'w', encoding='utf-8', newline='\n') as file:
    file.write(plan)
print(f'{output}: {plan.count(chr(10))} linhas')

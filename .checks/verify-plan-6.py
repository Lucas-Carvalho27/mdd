# Confere o plano formatado (depois do Prettier) contra o branch por tarefa: cada arquivo
# inteiro e cada saída aparecem iguais, e os blocos "Troque / por" de cada arquivo, aplicados
# em ordem sobre a base, dão o arquivo final.
# Uso (na raiz do branch por tarefa, no último commit): python .checks/verify-plan-6.py <plano.md> <modelo.md>
import re
import subprocess
import sys

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


def blocks(lang):
    """O conteúdo de todos os blocos de código do plano com essa linguagem."""
    return [
        body for _, found, body in re.findall(r'(`{3,})(\w*)\n(.*?)\n\1(?!`)', plan, re.S)
        if found == lang
    ]


plan_path, template_path = sys.argv[1:]
plan = read(plan_path)
template = read(template_path)
markers = re.findall(r'@@(\w+) ([^@\s]+)@@', template)
problems = 0

# Arquivos inteiros e saídas
for kind, path in markers:
    if kind == 'FILE':
        lang = next((lang for ext, lang in LANG.items() if path.endswith(ext)), '')
        if read(path).rstrip() not in blocks(lang):
            print('DIFERENTE (arquivo inteiro):', path)
            problems += 1
    elif kind == 'OUT':
        if read(f'.checks/out/{path}.txt').rstrip() not in blocks(''):
            print('DIFERENTE (saída):', path)
            problems += 1

# Troque / por, na ordem do plano
IGNORE = r'<!-- prettier-ignore -->\n'
BEFORE = r'(`{3,})\w*\n(.*?)\n\1(?!`)'
AFTER = r'(`{3,})\w*\n(.*?)\n\3(?!`)'
pairs = [
    (match.group(2), match.group(4))
    for match in re.finditer(rf'Troque:\n\n{IGNORE}{BEFORE}\n\npor:\n\n{IGNORE}{AFTER}', plan, re.S)
]
index = 0
for kind, path in markers:
    if kind != 'EDITS':
        continue
    text = base(path)
    target = read(path)
    # Os pares deste arquivo são os que, aplicados, levam a base ao arquivo final.
    applied = 0
    while index < len(pairs) and text != target:
        before, after = pairs[index]
        if text.count(before) != 1:
            break
        text = text.replace(before, after, 1)
        index += 1
        applied += 1
    status = 'ok' if text == target else 'DIFERENTE'
    if status != 'ok':
        problems += 1
    print(f'{status}: {path} ({applied} trechos)')

print(f'marcadores: {len(markers)}; pares no plano: {len(pairs)}, usados: {index}')
print('problemas:', problems)

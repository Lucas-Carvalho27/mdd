# Confere o plano formatado contra o protótipo: cada arquivo inteiro aparece igual, e os
# blocos "Troque / por" de cada arquivo, aplicados em ordem sobre a base, dão o arquivo final.
# Uso (na raiz do protótipo): python .checks/verify-plan.py <plano.md> <modelo.md>
import re
import sys

LANG = {'.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.mjs': 'js', '.sh': 'bash'}
BASE_BRANCH = 'd4078b1'
NOTICE_OLD = '<span className="flex-1">Edição recusada: {notice}</span>'
NOTICE_NEW = '<span className="flex-1">{notice}</span>'


def read(path):
    with open(path, encoding='utf-8') as file:
        return file.read()


def base(path, variant):
    import subprocess

    text = subprocess.run(
        ['git', 'show', f'{BASE_BRANCH}:{path}'], capture_output=True, check=True
    ).stdout.decode('utf-8')
    return text


plan_path, template_path = sys.argv[1:]
plan = read(plan_path)
template = read(template_path)
markers = re.findall(r'@@(\w+) ([^@\s]+)(?: ([^@\s]+))?@@', template)
problems = 0

# Arquivos inteiros
for kind, path, _ in markers:
    if kind != 'FILE':
        continue
    lang = next((lang for ext, lang in LANG.items() if path.endswith(ext)), '')
    block = f'```{lang}\n{read(path).rstrip()}\n```'
    if block not in plan:
        print('DIFERENTE (arquivo inteiro):', path)
        problems += 1

# Troque / por, na ordem do plano
IGNORE = r'<!-- prettier-ignore -->\n'
pairs = re.findall(
    rf'Troque:\n\n{IGNORE}```\w*\n(.*?)\n```\n\npor:\n\n{IGNORE}```\w*\n(.*?)\n```', plan, re.S
)
edit_markers = [(path, variant) for kind, path, variant in markers if kind == 'EDITS']
index = 0
for path, variant in edit_markers:
    text = base(path, variant or None)
    target = read(path)
    # Os pares deste arquivo são os que, aplicados, levam a base ao arquivo final.
    applied = 0
    while index < len(pairs) and text != target:
        before, after = pairs[index]
        if text.count(before + '\n') != 1 and text.count(before) != 1:
            break
        text = text.replace(before, after, 1)
        index += 1
        applied += 1
    status = 'ok' if text == target else 'DIFERENTE'
    if status != 'ok':
        problems += 1
    print(f'{status}: {path} ({applied} trechos)')

print(f'pares no plano: {len(pairs)}, usados: {index}')
print('problemas:', problems)

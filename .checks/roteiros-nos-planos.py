# Confere se os roteiros antigos de .checks/ são iguais à última versão deles nos planos.
# Uso (na raiz): python .checks/roteiros-nos-planos.py
import glob
import re

NAMES = [
    'configurations-check.mts', 'save-safety-check.mts', 'generation-support.mts',
    'generate-product-check.mts', 'fragment-source-check.mts', 'assets-store-check.mts',
    'configurator-store-check.mts', 'generation-store-check.mts', 'cdp.mjs', 'quit.mjs',
    'main-process.mjs', 'run-ui.sh', 'ui-check.mjs', 'configurador-ui.mjs', 'assets-ui.mjs',
    'geracao-ui.mjs'
]
plans = sorted(glob.glob('C:/Users/lucas/Desktop/mdd/docs/superpowers/plans/*.md'))
blocks = []  # (plano, texto do bloco), na ordem dos planos
for plan in plans:
    text = open(plan, encoding='utf-8').read()
    for match in re.finditer(r'```\w*\n(.*?)\n```', text, re.S):
        blocks.append((plan.split('/')[-1].split('\\')[-1], match.group(1)))

for name in NAMES:
    local = open(f'.checks/{name}', encoding='utf-8').read().rstrip()
    # O bloco do roteiro é o que tem as duas primeiras linhas iguais às do arquivo local
    # (o comentário de cabeçalho), ou que é igual ao arquivo local.
    head = '\n'.join(local.split('\n')[:2])
    found = [(plan, block) for plan, block in blocks if block.startswith(head) or block == local]
    if not found:
        print(f'SEM BLOCO: {name}')
        continue
    same = [plan for plan, block in found if block == local]
    last_plan = found[-1][0]
    status = 'igual à última versão' if found[-1][1] == local else 'DIFERENTE da última versão'
    print(f'{name}: {status} ({last_plan}); iguais em: {", ".join(same) or "nenhum"}')

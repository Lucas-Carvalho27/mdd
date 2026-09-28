#!/usr/bin/env bash
# Prepara uma cópia limpa do exemplo, abre o app, roda um roteiro de interface e fecha o app.
# Uso: bash .checks/run-ui.sh <app.exe | dev> <roteiro> [argumentos extras do roteiro...]
# Com EXAMPLE=herby, a cópia é do exemplo herby (Fase 7), em .checks/herby-ui.
set -u
app="$1"; script="$2"; shift 2
example="${EXAMPLE:-loja-online}"
copy=.checks/loja-ui
[ "$example" = "herby" ] && copy=.checks/herby-ui
rm -rf .checks/ui-data "$copy" && mkdir -p .checks/ui-data
cp -r "docs/examples/$example" "$copy"
if [ "$script" = ".checks/configurador-ui.mjs" ]; then
  cat > .checks/loja-ui/configurations/conflito.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns="urn:mdd:configuration" schemaVersion="1" name="Conflito">
  <decision feature="catalogo" state="deselected"/>
  <decision feature="busca" state="selected"/>
</configuration>
XML
fi
dir="$(cygpath -w "$PWD/$copy")"
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: process.argv[2] }]))" "$dir" "$(basename "$copy")"
if [ "$app" = "dev" ]; then exe=./node_modules/electron/dist/electron.exe; first=.; else exe="$app"; first=; fi
"$exe" $first --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" > /dev/null 2>&1 &
for i in $(seq 1 30); do curl -s http://127.0.0.1:9333/json > /dev/null 2>&1 && break; sleep 1; done
# Logo depois de um build, a tela inicial demora mais: espera a lista de recentes aparecer.
node -e "import('./.checks/cdp.mjs').then(async ({ connect }) => { const ui = await connect(9333); await ui.waitFor(\"document.querySelector('main section ul button') !== null\", 30000); ui.close() })"
node "$script" 9333 "$@" "$dir"
node .checks/quit.mjs 9333
sleep 2

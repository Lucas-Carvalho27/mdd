#!/usr/bin/env bash
# Confere uma tarefa do plano da Fase 8 no branch por tarefa.
# Uso: bash .checks/por-tarefa-7.sh <1-2> antes   → os roteiros novos da tarefa falham
#      bash .checks/por-tarefa-7.sh <1-2> depois  → typecheck, lint e todos os roteiros iguais ao guardado
set -u
task="$1"; moment="$2"
run() { npx tsx --tsconfig tsconfig.web.json ".checks/$1.mts" $3 > ".checks/out/agora-$2.txt" 2>&1; }
same() {
  if diff -q ".checks/out/$2.txt" ".checks/out/agora-$1.txt" > /dev/null; then echo "  igual: $1"
  else echo "  DIFERENTE: $1 (esperado .checks/out/$2.txt)"; diff ".checks/out/$2.txt" ".checks/out/agora-$1.txt" | head -8; fi
}
fails() {
  if run "$1" "$1" "${2:-}"; then echo "  NÃO FALHOU: $1"
  else echo "  falhou: $1 — $(grep -m1 -oE "(Cannot find module|does not provide an export named|is not a function|ENOENT|ERR_[A-Z_]+)[^\n]{0,70}" ".checks/out/agora-$1.txt")"; fi
}
# Cada item: roteiro:saída-guardada[:argumento]
case "$task" in
  1) new="edited-storage-check:edited-storage-check page-preview-check:page-preview-check"
     old="html-page-check:html-page-check html-checker-check:html-checker-check herby-generate:herby-generate:completa-atibaia generate-product-check:generate-product-t2 generation-plan-check:generation-plan-check-base" ;;
  2) new="pages-store-check:pages-store-check"
     old="html-store-check:html-store-check fragments-store-check:fragments-store-check assets-store-check:assets-store-check-t4 configurator-store-check:configurator-store-check-t4 generation-store-check:generation-store-check-t4" ;;
esac
echo "Tarefa $task, $moment"
if [ "$moment" = antes ]; then
  for item in $new; do IFS=: read -r script saved arg <<< "$item"; fails "$script" "$arg"; done
  exit 0
fi
npm run typecheck > .checks/out/agora-typecheck.txt 2>&1 && echo "  typecheck limpo" || { echo "  TYPECHECK FALHOU"; grep -m5 "error" .checks/out/agora-typecheck.txt; }
npm run lint > .checks/out/agora-lint.txt 2>&1 && echo "  lint limpo" || { echo "  LINT FALHOU"; grep -m5 -E "error|warning" .checks/out/agora-lint.txt; }
for item in $new $old; do IFS=: read -r script saved arg <<< "$item"; run "$script" "$script" "$arg"; same "$script" "$saved"; done

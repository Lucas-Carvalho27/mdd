#!/usr/bin/env bash
# Confere uma tarefa do plano da Fase 6 no branch por tarefa.
# Uso: bash .checks/por-tarefa.sh <1-4> antes   → os roteiros novos da tarefa falham
#      bash .checks/por-tarefa.sh <1-4> depois  → typecheck, lint e todos os roteiros iguais ao guardado
set -u
task="$1"; moment="$2"
run() { npx tsx --tsconfig tsconfig.web.json ".checks/$1.mts" > ".checks/out/agora-$1.txt" 2>&1; }
same() {
  if diff -q ".checks/out/$2.txt" ".checks/out/agora-$1.txt" > /dev/null; then echo "  igual: $1"
  else echo "  DIFERENTE: $1 (esperado .checks/out/$2.txt)"; diff ".checks/out/$2.txt" ".checks/out/agora-$1.txt" | head -8; fi
}
fails() {
  if run "$1"; then echo "  NÃO FALHOU: $1"
  else echo "  falhou: $1 — $(grep -m1 -oE "(Cannot find module|does not provide an export named|is not a function|ERR_[A-Z_]+)[^\n]{0,70}" ".checks/out/agora-$1.txt")"; fi
}
case "$task" in
  1) new="fragment-path-check:fragment-path-check text-format-check:text-format-check"
     old="configurations-check:configurations-check-t1 save-safety-check:save-safety-check-t1" ;;
  2) new="fragment-checker-check:fragment-checker-check"
     old="fragment-source-check:fragment-source-t2 generate-product-check:generate-product-t2" ;;
  3) new="save-fragments-check:save-fragments-check"; old="" ;;
  4) new="fragments-store-check:fragments-store-check"
     old="assets-store-check:assets-store-check-t4 configurator-store-check:configurator-store-check-t4 generation-store-check:generation-store-check-t4" ;;
esac
echo "Tarefa $task, $moment"
if [ "$moment" = antes ]; then
  for pair in $new; do fails "${pair%%:*}"; done
  exit 0
fi
npm run typecheck > .checks/out/agora-typecheck.txt 2>&1 && echo "  typecheck limpo" || { echo "  TYPECHECK FALHOU"; grep -m5 "error" .checks/out/agora-typecheck.txt; }
npm run lint > .checks/out/agora-lint.txt 2>&1 && echo "  lint limpo" || { echo "  LINT FALHOU"; grep -m5 -E "error|warning" .checks/out/agora-lint.txt; }
for pair in $new $old; do run "${pair%%:*}"; same "${pair%%:*}" "${pair#*:}"; done

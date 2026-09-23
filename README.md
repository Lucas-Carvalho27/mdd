# mdd

Ferramenta desktop para linhas de produto: modela Feature Models, configura produtos e gera a
documentação de cada produto a partir de fragmentos XML.

- Linguagem do domínio: [CONTEXT.md](CONTEXT.md)
- Especificação: [docs/SPEC.md](docs/SPEC.md)
- Decisões de arquitetura: [docs/adr/](docs/adr/)

## Desenvolvimento

    npm install
    npm run dev        # abre o app com recarga automática
    npm run lint       # inclui as regras de camada
    npm run typecheck
    npm run build:win  # gera o instalador em dist/

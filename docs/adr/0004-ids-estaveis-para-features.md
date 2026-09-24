# Features referenciadas por ID estável, não pelo nome

Configurações, assets e restrições ficam em arquivos diferentes e referenciam features. Se a referência fosse o nome (como no FeatureIDE), renomear uma feature quebraria arquivos que podem nem estar abertos. Cada feature tem um ID no formato `[a-z][a-z0-9_]*`, definido na criação (sugerido a partir do nome e ajustável naquele momento) e imutável depois, na primeira versão; o nome de exibição é livre.

## Consequences

- O ID usa `_` e não `-` para não conflitar com o operador de subtração quando restrições com atributos chegarem.
- As palavras reservadas da linguagem de expressões (`not`, `and`, `or`, `implies`, `iff`, `true`, `false`) não podem ser IDs.
- Os assets seguem a mesma regra (Fase 4): o ID é sugerido pelo nome do arquivo ao vincular, pode ser ajustado nesse momento e depois não muda, nem quando o arquivo do asset é trocado. É o ID que aparece no produto gerado (`<fragment asset="…">`).

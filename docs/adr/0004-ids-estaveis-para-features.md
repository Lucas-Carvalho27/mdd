# Features referenciadas por ID estável, não pelo nome

Configurações, assets e restrições ficam em arquivos diferentes e referenciam features. Se a referência fosse o nome (como no FeatureIDE), renomear uma feature quebraria arquivos que podem nem estar abertos. Cada feature tem um ID gerado na criação a partir do nome, no formato `[a-z][a-z0-9_]*`, imutável na primeira versão; o nome de exibição é livre.

## Consequences

- O ID usa `_` e não `-` para não conflitar com o operador de subtração quando restrições com atributos chegarem.
- As palavras reservadas da linguagem de expressões (`not`, `and`, `or`, `implies`, `iff`, `true`, `false`) não podem ser IDs.

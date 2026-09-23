# Arquitetura em camadas imposta por lint, sem testes na primeira versão

O código do renderer é dividido em `domain` → `application` → `infrastructure` / `ui`, com a regra de que as dependências apontam só para dentro: o domínio é TypeScript puro, sem React, Electron nem bibliotecas de XML ou SAT. A escolha foi por camadas no topo, e não por módulos, porque os contextos (modelo, configuração, assets, geração) são muito acoplados entre si. Por decisão do projeto, não haverá testes automatizados na primeira versão; o `eslint-plugin-boundaries` transforma em erro de lint qualquer import que viole a regra de dependência e é a principal proteção da arquitetura.

## Consequences

- Como o domínio é puro, adicionar testes depois (Vitest) não exige refatoração.
- Toda edição do modelo é um Command com `execute()` e `undo()`, o que concentra a lógica de edição fora dos componentes e dá desfazer e refazer.

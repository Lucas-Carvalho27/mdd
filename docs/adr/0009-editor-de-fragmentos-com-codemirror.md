# Editor de fragmentos com CodeMirror 6

Os fragmentos são editados dentro do app (Fase 6), num editor de XML com realce de sintaxe, números de linha, desfazer, busca e sublinhado de erros. Usamos o **CodeMirror 6**, uma biblioteca feita para editores de código no navegador. Ela é leve, não usa `eval` nem web workers e roda dentro do `app.asar` com a CSP atual (`style-src` já aceita `'unsafe-inline'`). Os pacotes entram um a um (`@codemirror/state`, `view`, `commands`, `language`, `lang-xml`, `search` e `lint`, mais o `@lezer/highlight` para as cores), em vez do pacote `codemirror` completo, para levar só o necessário.

## Considered Options

- **Monaco** (o editor do VS Code): pesa vários MB, depende de web workers e exige configuração própria de empacotamento no electron-vite. É demais para um editor simples com cores.
- **Feito à mão** (uma `<textarea>` transparente sobre um `<pre>` pintado por um tokenizador próprio): sem dependência, mas a sincronia da rolagem e da seleção é frágil e fica lenta em arquivos grandes. Os números de linha, a busca e o desfazer por arquivo teriam de ser feitos do zero.

## Consequences

- O CodeMirror só fica na interface (`ui/screens/fragments/`). O texto que ele edita é um `FragmentDocument` da aplicação, e a conferência é a mesma da geração (`FragmentChecker`), com os problemas mostrados como diagnósticos do `@codemirror/lint`.
- O CodeMirror troca toda quebra de linha por `\n` e não sabe do BOM. O domínio guarda o formato do arquivo (`text-format.ts`) e o devolve ao gravar, para que só mude no disco o que foi editado.
- O desfazer é do próprio CodeMirror, fora do histórico de comandos do projeto (ADR 0008): o `EditorState` de cada arquivo fica guardado enquanto o projeto está aberto, e Ctrl+Z na aba Fragmentos desfaz o texto, nunca o modelo.
- As cores vêm de variáveis CSS do tema (`--xml-*`), com valores para o tema claro e o escuro.
- Os textos do editor (busca, problemas, "Ir para a linha") são traduzidos por `EditorState.phrases`. Uma versão nova do CodeMirror pode trazer textos novos, que aparecem em inglês até entrarem na lista.
- Os roteiros de interface chegam ao `EditorView` por uma propriedade interna do DOM (`cmTile` desde a versão 6.43; antes, `cmView`). Ao atualizar o `@codemirror/view`, confira o `fragmentos-ui.mjs`.

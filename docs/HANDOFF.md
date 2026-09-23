# Handoff — onde paramos e como continuar

Atualizado em 23/09/2026. Leia este arquivo primeiro ao retomar o projeto.

## Estado atual

| Fase                      | Situação                          | Onde está                                                                                                                                                                     |
| ------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundação               | Concluída                         | `main` (GitHub)                                                                                                                                                               |
| 1. Domínio e persistência | Concluída                         | `main` (GitHub)                                                                                                                                                               |
| **2A. Edição do modelo**  | **Tarefas 1–7 feitas; falta a 8** | `main` e branch `fase-2a-edicao` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md) |
| 2B. Diagrama visual       | A planejar                        | —                                                                                                                                                                             |
| 3. Configurador           | A planejar                        | —                                                                                                                                                                             |
| 4. Assets                 | A planejar                        | —                                                                                                                                                                             |
| 5. Geração                | A planejar                        | —                                                                                                                                                                             |

O app abre uma pasta de projeto, valida os XMLs em três etapas (XML bem-formado, XSD e regras do domínio), mostra o modelo numa lista e salva tudo de volta sem mudar um byte.

Com a Fase 2A (commit `69033be`, já na `main` a seu pedido, antes da aceitação manual), o app também:

- edita o modelo (features, grupos, atributos e restrições), com desfazer/refazer e diálogo de impacto ao excluir;
- cria projetos e reabre os recentes;
- mostra "•" no título com alterações não salvas e salva com Ctrl+S;
- pergunta o que fazer quando um arquivo foi alterado fora do app, e confirma antes de fechar com alterações.

Esse código veio do protótipo em que o plano foi verificado, num único commit (e não um commit por tarefa). No repositório, passou de novo por Prettier, typecheck, lint e build, e as saídas de todas as verificações do plano, incluindo o roteiro da interface, bateram exatamente com as esperadas.

Documentos de referência:

- [CONTEXT.md](../CONTEXT.md): glossário do domínio.
- [SPEC.md](SPEC.md): especificação completa e roadmap (§9).
- [adr/](adr/): as decisões de arquitetura e o porquê de cada uma.
- [superpowers/plans/](superpowers/plans/): um plano por fase, com o código de cada tarefa.

## Como retomar a Fase 2A

1. Troque para o branch da fase e instale as dependências. O `postinstall` também baixa o binário do Electron.

   ```bash
   git switch fase-2a-edicao
   npm install
   ```

2. Confirme a decisão sobre IDs (seção abaixo).

3. Peça ao Claude, numa sessão nova:

   > Leia docs/HANDOFF.md e execute a Tarefa 8 do plano docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md. As Tarefas 1 a 7 já estão no branch.

   A Tarefa 8 atualiza a SPEC e os ADRs 0004 e 0008, gera o instalador e tem a **aceitação manual**: recriar o exemplo pela interface, fechar a janela com alterações e reabrir pelos recentes. Faça-a no branch `fase-2a-edicao` (que está igual à `main`) e depois leve o branch para a `main` de novo.

4. Os scripts de verificação estão em `.checks/` só nesta máquina (a pasta é ignorada pelo git de propósito). Num clone novo, recrie os que precisar a partir dos planos. O `cdp-eval.mjs` está no plano da Fase 1 (Tarefa 6, Passo 8); os da 2A estão no plano da 2A.

## Decisão a confirmar

A Fase 2A **mudou um pouco a regra de IDs** (ADR 0004). A mudança já está implementada no commit `69033be`, mas o ADR e a SPEC só são atualizados na Tarefa 8, depois do seu ok:

- **Antes (ADR 0004):** o ID é gerado do nome na criação e nunca muda.
- **Agora:** ao criar uma feature (Tab, Enter ou botões) ou um projeto, abre um diálogo com **Nome** e **ID**. O ID é sugerido a partir do nome e pode ser ajustado **só naquele momento**. Depois fica imutável, como antes.
- **Motivo:** sem isso, toda feature criada pela interface nasceria com ID `nova_feature`, e seria impossível recriar o exemplo `loja-online` (o critério de aceitação da Fase 2).

Se preferir outra solução, ela precisa mudar o código dos diálogos de nova feature e de novo projeto (Tarefas 1, 6 e 7 do plano) antes da Tarefa 8.

## Checagens manuais ainda não confirmadas

Estas dependem do diálogo nativo de pastas do Windows, que o Claude não consegue operar:

- **Fase 0:** em `dist/win-unpacked/mdd.exe`, "Abrir pasta de projeto" em `docs/examples/loja-online` lista os arquivos sem mensagem vermelha.
- **Fase 1** (plano da Fase 1, Tarefa 7 Passo 9 e Tarefa 8 Passo 7):
  - abrir o exemplo e ver as 8 features, a restrição, os 6 assets e a configuração;
  - Salvar sem mudar o `git status`;
  - editar o `model.xml` por fora e ver o erro ao salvar;
  - abrir as cópias quebradas (`loja-duplicado`, `loja-hifen`, `loja-max0`) e ver o erro com arquivo e linha.

  As cópias quebradas ficam na pasta temporária do Windows (`C:\Users\lucas\AppData\Local\Temp`) e podem ter sido apagadas. O plano da Fase 1 tem os comandos para recriá-las.

## Como trabalhamos (e vale manter)

- **Uma fase por vez, com um plano por fase.** Antes de escrever o plano, o código é prototipado e verificado numa cópia descartável do repositório. O plano contém o código já testado.
- **Sem testes automatizados** (ADR 0008). A verificação usa typecheck, lint e scripts descartáveis em `.checks/`, rodados com `npx tsx`. A interface é checada pelo protocolo de depuração do Chromium (`--remote-debugging-port`).
- **Um branch por fase**, com um commit por tarefa e merge local na `main` ao fim, depois das checagens.
- **Para dirigir a interface sem o diálogo nativo:** rode o app com `--user-data-dir` apontando para uma pasta própria e com um `recent-projects.json` que já contém o projeto. O projeto abre pela lista de recentes. O roteiro `ui-check.mjs` da 2A faz isso.

## Armadilhas já encontradas

- **Electron 44** não baixa o binário no `npm install`. Por isso o `postinstall` roda `install-electron`.
- **CLI do shadcn:** não instala todas as dependências dos componentes (faltaram `class-variance-authority` e `lucide-react`) e gera textos em inglês ("Close"). Confira os imports depois de cada `npx shadcn add`.
- **`git commit -m` no PowerShell 5.1** quebra mensagens que têm aspas. Use o Git Bash ou `git commit -F arquivo`.
- **Quebras de linha:** o `.gitattributes` força LF. Sem isso, o `core.autocrlf=true` desta máquina quebraria a comparação byte a byte dos XMLs.
- **`xmllint-wasm`** funciona de dentro do `app.asar` sem `asarUnpack`. Isso já foi testado.
- **Scripts de verificação da interface:** entre digitar num campo e sair dele, espere um pouco. O React precisa processar a digitação antes do `blur`.
- **Recentes:** o `reopenProject` só aceita pastas que já estão na lista, para que o renderer não possa apontar a raiz do projeto para qualquer lugar.

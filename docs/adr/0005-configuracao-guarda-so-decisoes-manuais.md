# Configuração persiste só as decisões manuais

Um arquivo de configuração guarda apenas as decisões manuais e os valores de atributos; tudo o que o solver deduz é recalculado ao abrir. Assim, quando o modelo muda, a configuração continua representando a intenção do usuário, e o app consegue dizer com precisão se ela ficou desatualizada: há referências órfãs ou as decisões manuais passaram a ser contraditórias. O estado (válida, completa, desatualizada) é sempre calculado, nunca salvo.

## Considered Options

- Salvar o estado final de todas as features (como o FeatureIDE faz com `manual`/`automatic`): o arquivo fica autossuficiente, mas deduções antigas passam a parecer escolhas do usuário depois que o modelo muda.

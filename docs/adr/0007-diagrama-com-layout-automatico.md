# Diagrama com layout automático, sem posições salvas

O editor do Feature Model é um diagrama gráfico (React Flow) cujo layout é sempre calculado automaticamente (elkjs, árvore de cima para baixo). As posições dos nós não são salvas no `model.xml`. Arrastar um nó sobre outro muda o **pai** da feature, não a posição dela. Isso mantém o diagrama sempre organizado e o XML só com semântica.

## Consequences

- A ordem entre irmãos é semântica — define a ordem das seções no produto gerado — e é alterada por menu de contexto ou atalho, não arrastando o nó para o lado.
- Restrições não são desenhadas como linhas no diagrama; ficam em um painel próprio.

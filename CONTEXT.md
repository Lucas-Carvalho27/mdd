# mdd — Linhas de Produto

Ferramenta para modelar a variabilidade de uma linha de produtos, configurar produtos a partir dela e gerar a documentação de cada produto a partir de fragmentos vinculados às features.

## Language

### Modelagem

**Projeto**:
Pasta que contém exatamente um Feature Model, seu mapeamento de assets e as configurações derivadas dele.
_Avoid_: workspace, solução

**Feature Model**:
Árvore de features com as regras que dizem quais combinações de features formam um produto válido.
_Avoid_: modelo de variabilidade, diagrama, árvore

**Feature**:
Uma característica da linha de produtos que pode ou não estar presente em um produto; identificada por um ID estável e exibida por um nome.
_Avoid_: funcionalidade, característica, módulo, nó

**Feature raiz**:
A única feature sem pai; está presente em todo produto.
_Avoid_: root node, feature principal

**Variabilidade**:
Se uma feature solitária é obrigatória (presente sempre que o pai estiver) ou opcional (pode faltar mesmo com o pai presente).
_Avoid_: tipo da feature, modo

**Feature solitária**:
Feature filha que não pertence a um grupo; sempre tem variabilidade.
_Avoid_: feature avulsa, feature simples

**Grupo**:
Conjunto de features irmãs cuja quantidade selecionada, quando o pai está presente, deve ficar dentro de uma cardinalidade `[min..max]`.
_Avoid_: grupo de features, set

**Alternative**:
Grupo com cardinalidade `[1..1]` — exatamente uma feature do grupo.
_Avoid_: XOR, escolha exclusiva

**Or**:
Grupo com cardinalidade `[1..*]` — pelo menos uma feature do grupo.
_Avoid_: OR inclusivo, múltipla escolha

**Restrição**:
Expressão lógica sobre features, fora da hierarquia, que todo produto válido precisa satisfazer.
_Avoid_: cross-tree constraint, regra, dependência

**Expressão**:
Fórmula proposicional sobre IDs de features, escrita com os operadores `not`, `and`, `or`, `implies` e `iff`.
_Avoid_: fórmula, condição (quando se referir à sintaxe)

**Atributo**:
Propriedade tipada declarada em uma feature; é **fixo** quando seu valor é definido no modelo ou **configurável** quando cada configuração escolhe o valor.
_Avoid_: propriedade, parâmetro, metadado

**Clone**:
Instância repetida de uma feature com cardinalidade própria; previsto no domínio, fora da primeira versão.
_Avoid_: feature multi-instância

### Configuração

**Configuração**:
Conjunto de decisões sobre as features de um Feature Model, que descreve um produto da linha.
_Avoid_: variante, perfil, produto (quando se referir à seleção)

**Decisão manual**:
Seleção ou desseleção de uma feature feita pelo usuário; é a única coisa persistida em uma configuração além dos valores de atributos.
_Avoid_: escolha, marcação

**Decisão propagada**:
Valor de uma feature que é consequência lógica das decisões manuais e das regras do modelo.
_Avoid_: decisão automática, inferência

**Configuração válida**:
Configuração cujas decisões manuais admitem ao menos um produto que satisfaz todas as regras do modelo.
_Avoid_: configuração consistente

**Configuração completa**:
Configuração válida em que toda feature está decidida e todo atributo configurável das features selecionadas tem valor.
_Avoid_: configuração final, configuração fechada

**Configuração desatualizada**:
Configuração que deixou de ser válida ou que referencia features ou atributos que não existem mais no modelo.
_Avoid_: configuração quebrada, configuração inválida (quando a causa for mudança do modelo)

### Assets e geração

**Asset**:
Referência a um arquivo dentro do projeto vinculada a uma feature; pode ser um fragmento ou um recurso.
_Avoid_: artefato, anexo, documento

**Fragmento**:
Asset que é um arquivo XML bem-formado e é embutido no produto gerado.
_Avoid_: trecho, snippet, capítulo

**Recurso**:
Asset que é apenas copiado para a saída do produto gerado (imagens, anexos, qualquer arquivo).
_Avoid_: mídia, arquivo auxiliar

**Âncora**:
Feature que determina onde um asset aparece no produto gerado.
_Avoid_: feature dona, feature pai

**Condição de presença**:
Expressão opcional de um asset que, junto com a âncora selecionada, determina quando ele entra no produto.
_Avoid_: filtro, regra do asset

**Interação de features**:
Conteúdo que só faz sentido quando duas ou mais features estão presentes juntas; é expresso por uma condição de presença.
_Avoid_: combinação, feature derivada

**Geração**:
Processo que transforma uma configuração completa em um produto gerado.
_Avoid_: build, exportação, derivação (use só em conversa sobre SPL em geral)

**Produto gerado**:
Pasta de saída com o `product.xml` e os recursos copiados, correspondente a uma configuração.
_Avoid_: produto (sem qualificador), release, pacote

**Seção**:
Parte do produto gerado que corresponde a uma feature selecionada e contém seus fragmentos e as seções das features filhas.
_Avoid_: capítulo, bloco

**Feature morta**:
Feature que não pode estar presente em nenhum produto válido; detectada pelas análises do modelo (fase futura).
_Avoid_: feature inválida, feature inalcançável

# Geração de documentação agnóstica de vocabulário XML

A documentação é escrita em XML e depois convertida para mídias diferentes, fora da ferramenta. O núcleo não conhece DITA, DocBook nem nenhum outro vocabulário: ele gera um `product.xml` com os metadados do produto e seções aninhadas na ordem da árvore, e embute cada fragmento intacto dentro de um `<fragment>`. Nenhum vocabulário padrão foi adotado — a decisão foi adiada de propósito, e adapters para DITA ou DocBook podem ser adicionados como outros `ProductDeriver` sem tocar no domínio.

## Consequences

- Fragmentos são embutidos (não referenciados via XInclude), então o `product.xml` é autossuficiente, mas cada fragmento precisa ser XML bem-formado. Entidades externas não são suportadas.
- Caminhos relativos dentro dos fragmentos são resolvidos com `xml:base` (a pasta de origem de cada fragmento), e os recursos são copiados mantendo a estrutura de pastas. Isso funciona sem saber qual atributo de cada vocabulário é um link.
- A variabilidade é composicional na primeira versão. O atributo `feature` em elementos de fragmentos fica reservado para a variabilidade anotativa futura.

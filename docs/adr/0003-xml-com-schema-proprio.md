# Persistência só em XML, com schema próprio

Todos os arquivos do projeto (`model.xml`, `assets.xml`, `configurations/*.xml`) e o produto gerado são XML com schemas próprios e versionados (`schemaVersion`), definidos em XSD. Não adotamos o formato do FeatureIDE nem UVL porque nenhum dos dois representa cardinalidade de grupo, atributos configuráveis por produto e o mapeamento de assets ao mesmo tempo — teríamos de estendê-los de qualquer forma. Também não há JSON: XML é o único formato.

## Consequences

- Expressões usam operadores por extenso (`not`, `and`, `or`, `implies`, `iff`) porque `&`, `<` e `>` exigiriam escape no XML.
- A escrita é determinística (ordem fixa de atributos e elementos, indentação de 2 espaços) para gerar diffs limpos no git.
- Importar FeatureIDE ou UVL no futuro é um adapter de importação, não uma mudança de formato.

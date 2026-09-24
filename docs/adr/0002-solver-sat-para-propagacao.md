# Propagação de configuração com solver SAT (logic-solver)

O modelo suporta restrições proposicionais livres e cardinalidade de grupo `[n..m]`. Nesse cenário, uma propagação caseira (propagação unitária) é incompleta: o usuário faz escolhas que parecem válidas e só descobre depois que não resta produto possível. Usamos o `logic-solver` (MiniSat compilado para JS, com suporte nativo a cardinalidade e somas inteiras) atrás da porta `ConstraintSolver`, e propagamos testando, para cada feature indecisa, se ela pode ser verdadeira e se pode ser falsa.

## Consequences

- O pacote não recebe atualizações desde 2022 (v2.0.1) e não tem tipos publicados; mantemos um `.d.ts` próprio em `infrastructure/solver`. Se virar problema, trocamos por um MiniSat em WASM escrevendo outro adapter.
- As análises futuras (`ModelAnalyzer`: features mortas, modelo vazio) e as restrições com atributos reaproveitam o mesmo motor.
- Cada resolução cria um solver novo, com as decisões manuais como regras. Reaproveitar um solver com suposições deixa cada pergunta mais lenta, porque a biblioteca copia a cada solução uma tabela que cresce a cada suposição. Cada instância reserva 64 MB, que o coletor de lixo devolve quando a resolução termina.

// O caminho escolhido no diálogo, relativo à raiz do projeto (plano da Fase 4, Tarefa 2).
// Uso: npx tsx .checks/project-root-check.mts
import { ProjectRoot } from '../src/main/project-root'

const root = new ProjectRoot()
root.open(String.raw`C:\projetos\loja-online`)
const log = (label: string, value: unknown): void => console.log(label.padEnd(34), '→', value)
const cases: [string, string][] = [
  ['arquivo numa subpasta', String.raw`C:\projetos\loja-online\docs\pagamento\boleto.xml`],
  ['outra caixa na raiz', String.raw`c:\PROJETOS\Loja-Online\docs\img\pix-fluxo.svg`],
  ['com barras normais', 'C:/projetos/loja-online/model.xml'],
  ['a própria pasta', String.raw`C:\projetos\loja-online`],
  ['pasta vizinha de nome parecido', String.raw`C:\projetos\loja-online-2\x.xml`],
  ['pasta de cima', String.raw`C:\projetos\outra.xml`],
  ['outro disco', String.raw`D:\fora\arquivo.xml`],
  ['caminho de rede', String.raw`\\servidor\pasta\a.xml`],
  ['pasta interna "..loja"', String.raw`C:\projetos\loja-online\..loja\a.xml`]
]
for (const [label, path] of cases) log(label, root.toRelative(path) ?? '(fora do projeto)')
log('resolve continua recusando ../', root.resolve('../fora.xml') ?? '(fora do projeto)')
log('resolve de um caminho do projeto', root.resolve('docs/busca/busca.xml'))

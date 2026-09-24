// A proteção de saida/ no processo main (plano da Fase 5, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
import { ProjectRoot } from '../src/main/project-root'

const root = new ProjectRoot()
root.open('C:/proj/loja')
for (const path of [
  'saida/loja-basica',
  'saida/.loja-basica.tmp',
  'saida/loja-basica/docs/img',
  'SAIDA/Loja-Basica',
  'saida/..loja',
  'saida',
  'saida/',
  'saida/.',
  'Saida/..',
  'saida/../model.xml',
  'saida2/x',
  'docs/saida/x',
  '../loja/saida/x',
  '../outra/saida/x',
  'C:/proj/loja/saida/x',
  'D:/saida/x'
]) {
  const absolute = root.resolveInOutput(path)
  console.log(path.padEnd(28), '→', absolute === null ? 'recusado' : `aceito (${absolute})`)
}

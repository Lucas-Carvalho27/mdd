/** Importação de arquivos como texto pelo Vite (`import xsd from './x.xsd?raw'`). */
declare module '*?raw' {
  const content: string
  export default content
}

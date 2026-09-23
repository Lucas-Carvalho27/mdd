import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type MddApi } from '../shared/ipc'

const api: MddApi = {
  openProjectFolder: () => ipcRenderer.invoke(IpcChannel.openProjectFolder),
  list: (relativeDir) => ipcRenderer.invoke(IpcChannel.list, relativeDir),
  readText: (relativePath) => ipcRenderer.invoke(IpcChannel.readText, relativePath),
  writeText: (relativePath, content, precondition) =>
    ipcRenderer.invoke(IpcChannel.writeText, relativePath, content, precondition),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
}

contextBridge.exposeInMainWorld('mdd', api)

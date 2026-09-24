import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type MddApi } from '../shared/ipc'

const api: MddApi = {
  openProjectFolder: () => ipcRenderer.invoke(IpcChannel.openProjectFolder),
  listRecentProjects: () => ipcRenderer.invoke(IpcChannel.listRecentProjects),
  reopenProject: (rootPath) => ipcRenderer.invoke(IpcChannel.reopenProject, rootPath),
  setUnsavedChanges: (unsaved) => ipcRenderer.send(IpcChannel.setUnsavedChanges, unsaved),
  list: (relativeDir) => ipcRenderer.invoke(IpcChannel.list, relativeDir),
  readText: (relativePath) => ipcRenderer.invoke(IpcChannel.readText, relativePath),
  writeText: (relativePath, content, precondition) =>
    ipcRenderer.invoke(IpcChannel.writeText, relativePath, content, precondition),
  remove: (relativePath, precondition) =>
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
}

contextBridge.exposeInMainWorld('mdd', api)

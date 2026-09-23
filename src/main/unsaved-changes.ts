import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { IpcChannel } from '../shared/ipc'

/*
 * Confirmação ao fechar a janela com alterações não salvas (SPEC §8). O renderer avisa
 * quando o estado muda; o main pergunta no evento `close`, antes de a janela sumir.
 */

const unsaved = new WeakMap<WebContents, boolean>()

export function registerUnsavedChangesHandler(): void {
  ipcMain.on(IpcChannel.setUnsavedChanges, (event, value: boolean) => {
    unsaved.set(event.sender, value)
  })
}

export function confirmCloseWithUnsavedChanges(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (!unsaved.get(window.webContents)) return
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Alterações não salvas',
      message: 'Há alterações não salvas no projeto.',
      detail: 'Se sair agora, elas serão perdidas.',
      buttons: ['Sair sem salvar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1
    })
    if (choice !== 0) event.preventDefault()
  })
}

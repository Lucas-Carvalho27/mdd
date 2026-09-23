import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { basename } from 'path'
import { IpcChannel, type IpcResult, type OpenedProject } from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import { ok } from './results'

export function registerProjectHandlers(root: ProjectRoot): void {
  ipcMain.handle(
    IpcChannel.openProjectFolder,
    async (event): Promise<IpcResult<OpenedProject | null>> => {
      const options: OpenDialogOptions = {
        title: 'Abrir pasta do projeto',
        properties: ['openDirectory', 'createDirectory']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)

      const rootPath = choice.filePaths[0]
      root.open(rootPath)
      return ok({ rootPath, name: basename(rootPath) })
    }
  )
}

import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { stat } from 'fs/promises'
import { basename } from 'path'
import { IpcChannel, type IpcResult, type OpenedProject } from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import type { RecentProjectsStore } from '../recent-projects'
import { fail, ok } from './results'

export function registerProjectHandlers(root: ProjectRoot, recents: RecentProjectsStore): void {
  const open = (rootPath: string): OpenedProject => {
    root.open(rootPath)
    recents.add(rootPath)
    return { rootPath, name: basename(rootPath) }
  }

  ipcMain.handle(
    IpcChannel.openProjectFolder,
    async (event): Promise<IpcResult<OpenedProject | null>> => {
      const options: OpenDialogOptions = {
        title: 'Escolher a pasta do projeto',
        properties: ['openDirectory', 'createDirectory']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)
      return ok(open(choice.filePaths[0]))
    }
  )

  ipcMain.handle(
    IpcChannel.pickFileInProject,
    async (event, title: string): Promise<IpcResult<string | null>> => {
      if (root.current === null) return fail('no-project', 'Nenhum projeto aberto.')
      const options: OpenDialogOptions = {
        title,
        defaultPath: root.current,
        properties: ['openFile']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)
      const relativePath = root.toRelative(choice.filePaths[0])
      if (relativePath === null) {
        return fail(
          'outside-project',
          'O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo.'
        )
      }
      return ok(relativePath)
    }
  )

  ipcMain.handle(IpcChannel.listRecentProjects, () => recents.list())

  ipcMain.handle(
    IpcChannel.reopenProject,
    async (_event, rootPath: string): Promise<IpcResult<OpenedProject>> => {
      // Só pastas que o usuário já escolheu no diálogo podem ser reabertas sem ele.
      if (!recents.includes(rootPath)) {
        return fail('outside-project', 'Essa pasta não está na lista de projetos recentes.')
      }
      const isFolder = await stat(rootPath).then(
        (info) => info.isDirectory(),
        () => false
      )
      if (!isFolder) {
        recents.remove(rootPath)
        return fail('not-found', `A pasta "${rootPath}" não existe mais.`)
      }
      return ok(open(rootPath))
    }
  )
}

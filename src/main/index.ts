import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectRoot } from './project-root'
import { RecentProjectsStore } from './recent-projects'
import { confirmCloseWithUnsavedChanges, registerUnsavedChangesHandler } from './unsaved-changes'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerXmlHandlers } from './ipc/xml-handlers'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'mdd',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  confirmCloseWithUnsavedChanges(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mdd.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const projectRoot = new ProjectRoot()
  const recents = new RecentProjectsStore(join(app.getPath('userData'), 'recent-projects.json'))
  registerProjectHandlers(projectRoot, recents)
  registerFileHandlers(projectRoot)
  registerXmlHandlers()
  registerUnsavedChangesHandler()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

import { ipcMain } from 'electron'
import {
  IpcChannel,
  type IpcResult,
  type XmlSchemaIssue,
  type XmlSchemaName
} from '../../shared/ipc'
import { validateAgainstSchema } from '../xml/schema-validator'
import { fail, ok } from './results'

export function registerXmlHandlers(): void {
  ipcMain.handle(
    IpcChannel.validateXml,
    async (
      _event,
      schema: XmlSchemaName | null,
      fileName: string,
      content: string
    ): Promise<IpcResult<XmlSchemaIssue[]>> => {
      try {
        return ok(await validateAgainstSchema(schema, fileName, content))
      } catch (error) {
        return fail('io', `Falha ao validar ${fileName}: ${(error as Error).message}`)
      }
    }
  )
}

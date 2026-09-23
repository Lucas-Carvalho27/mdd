import type { IpcErrorCode, IpcResult } from '../../shared/ipc'

export function ok<T>(value: T): IpcResult<T> {
  return { ok: true, value }
}

export function fail<T>(code: IpcErrorCode, message: string): IpcResult<T> {
  return { ok: false, error: { code, message } }
}

import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'

export interface ExportOptions {
    connectionId: string
    sql: string
    outputPath: string
}

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const exportService = {
    async exportToCSV(options: ExportOptions): Promise<void> {
        if (isVSCode()) {
            return postVSCodeMessage<void>('export_to_csv', {
                connectionId: options.connectionId,
                sql: options.sql,
                outputPath: options.outputPath,
            })
        }
        if (isTauri()) {
            return safeInvoke('export_to_csv', {
                connectionId: options.connectionId,
                sql: options.sql,
                outputPath: options.outputPath,
            }) as Promise<void>
        }
        throw new TauriNotAvailableError('exportToCSV')
    },

    async exportToJSON(options: ExportOptions, pretty: boolean = true): Promise<void> {
        if (isVSCode()) {
            return postVSCodeMessage<void>('export_to_json', {
                connectionId: options.connectionId,
                sql: options.sql,
                outputPath: options.outputPath,
                pretty,
            })
        }
        if (isTauri()) {
            return safeInvoke('export_to_json', {
                connectionId: options.connectionId,
                sql: options.sql,
                outputPath: options.outputPath,
                pretty,
            }) as Promise<void>
        }
        throw new TauriNotAvailableError('exportToJSON')
    },

    async exportQueryToFile(
        connectionId: string,
        sql: string,
        outputPath: string,
        format: 'csv' | 'json',
    ): Promise<void> {
        if (isVSCode()) {
            return postVSCodeMessage<void>('export_query_to_file', {
                connectionId,
                sql,
                outputPath,
                format,
            })
        }
        if (isTauri()) {
            return safeInvoke('export_query_to_file', {
                connectionId,
                sql,
                outputPath,
                format,
            }) as Promise<void>
        }
        throw new TauriNotAvailableError('exportQueryToFile')
    },
}

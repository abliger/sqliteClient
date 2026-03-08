import { safeInvoke, isTauri } from '@utils/tauri'

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
        if (!isTauri()) throw new TauriNotAvailableError('exportToCSV')
        return safeInvoke('export_to_csv', {
            connectionId: options.connectionId,
            sql: options.sql,
            outputPath: options.outputPath,
        }) as Promise<void>
    },

    async exportToJSON(options: ExportOptions, pretty: boolean = true): Promise<void> {
        if (!isTauri()) throw new TauriNotAvailableError('exportToJSON')
        return safeInvoke('export_to_json', {
            connectionId: options.connectionId,
            sql: options.sql,
            outputPath: options.outputPath,
            pretty,
        }) as Promise<void>
    },

    async exportQueryToFile(
        connectionId: string,
        sql: string,
        outputPath: string,
        format: 'csv' | 'json',
    ): Promise<void> {
        if (!isTauri()) throw new TauriNotAvailableError('exportQueryToFile')
        return safeInvoke('export_query_to_file', {
            connectionId,
            sql,
            outputPath,
            format,
        }) as Promise<void>
    },
}

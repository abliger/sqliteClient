import { invoke } from '@tauri-apps/api/core'

export interface ExportOptions {
  connectionId: string
  sql: string
  outputPath: string
}

export const exportService = {
  async exportToCSV(options: ExportOptions): Promise<void> {
    return invoke('export_to_csv', {
      connectionId: options.connectionId,
      sql: options.sql,
      outputPath: options.outputPath
    })
  },

  async exportToJSON(options: ExportOptions, pretty: boolean = true): Promise<void> {
    return invoke('export_to_json', {
      connectionId: options.connectionId,
      sql: options.sql,
      outputPath: options.outputPath,
      pretty
    })
  },

  async exportQueryToFile(
    connectionId: string,
    sql: string,
    outputPath: string,
    format: 'csv' | 'json'
  ): Promise<void> {
    return invoke('export_query_to_file', {
      connectionId,
      sql,
      outputPath,
      format
    })
  }
}

import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'

export interface ImportFileInfo {
    extension: string
    name: string
    description: string
}

export interface ImportPreview {
    columns: string[]
    rows: Record<string, string>[]
    total_rows: number
    suggested_types: Record<string, string>
}

export interface ColumnMapping {
    source_column: string
    target_column: string
    data_type: string
    is_primary_key: boolean
    nullable: boolean
    default_value?: string
}

export interface ImportConfig {
    table_name: string
    overwrite_existing: boolean
    column_mappings: ColumnMapping[]
    csv_delimiter?: string
    csv_has_header: boolean
    excel_sheet_index: number
    skip_rows: number
    batch_size: number
}

export interface ImportResult {
    imported_rows: number
    failed_rows: number
    errors: string[]
    table_name: string
    duration_ms: number
}

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const importService = {
    async getSupportedFormats(): Promise<ImportFileInfo[]> {
        if (isVSCode()) {
            return postVSCodeMessage<ImportFileInfo[]>('get_supported_import_formats')
                .catch(() => [
                    { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
                    { extension: 'xlsx', name: 'Excel', description: 'Microsoft Excel 2007+' },
                    { extension: 'xls', name: 'Excel 97-2003', description: 'Microsoft Excel 97-2003' },
                ])
        }
        if (isTauri()) {
            return safeInvoke('get_supported_import_formats') as Promise<ImportFileInfo[]>
        }
        return [
            { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
            { extension: 'xlsx', name: 'Excel', description: 'Microsoft Excel 2007+' },
            { extension: 'xls', name: 'Excel 97-2003', description: 'Microsoft Excel 97-2003' },
        ]
    },

    async parseImportFile(filePath: string, fileType: string): Promise<ImportPreview> {
        if (isVSCode()) return postVSCodeMessage<ImportPreview>('parse_import_file', { filePath, fileType })
        if (isTauri()) return safeInvoke('parse_import_file', { filePath, fileType }) as Promise<ImportPreview>
        throw new TauriNotAvailableError('parseImportFile')
    },

    async detectColumnTypes(
        previewData: Record<string, string>[],
    ): Promise<Record<string, string>> {
        if (isVSCode() || !isTauri()) {
            const types: Record<string, string> = {}
            if (previewData.length > 0) {
                const firstRow = previewData[0]
                Object.keys(firstRow).forEach(col => {
                    const value = firstRow[col]
                    if (/^\d+$/.test(value)) {
                        types[col] = 'INTEGER'
                    } else if (/^\d+\.\d+$/.test(value)) {
                        types[col] = 'REAL'
                    } else {
                        types[col] = 'TEXT'
                    }
                })
            }
            return types
        }
        return safeInvoke('detect_column_types', { previewData }) as Promise<Record<string, string>>
    },

    async executeImport(
        connectionId: string,
        config: ImportConfig,
        previewData: Record<string, string>[],
    ): Promise<ImportResult> {
        if (isVSCode()) return postVSCodeMessage<ImportResult>('execute_import', { connectionId, config, previewData })
        if (isTauri()) return safeInvoke('execute_import', { connectionId, config, previewData }) as Promise<ImportResult>
        throw new TauriNotAvailableError('executeImport')
    },

    async validateTableName(connectionId: string, tableName: string): Promise<boolean> {
        if (isVSCode()) return postVSCodeMessage<boolean>('validate_table_name', { connectionId, tableName })
        if (isTauri()) return safeInvoke('validate_table_name', { connectionId, tableName }) as Promise<boolean>
        throw new TauriNotAvailableError('validateTableName')
    },
}

export const SQLITE_DATA_TYPES = [
    { value: 'TEXT', label: 'TEXT', description: '文本字符串' },
    { value: 'INTEGER', label: 'INTEGER', description: '整数值' },
    { value: 'REAL', label: 'REAL', description: '浮点数' },
    { value: 'NUMERIC', label: 'NUMERIC', description: '数值型' },
    { value: 'BOOLEAN', label: 'BOOLEAN', description: '布尔值 (0/1)' },
    { value: 'DATE', label: 'DATE', description: '日期' },
    { value: 'DATETIME', label: 'DATETIME', description: '日期时间' },
    { value: 'BLOB', label: 'BLOB', description: '二进制数据' },
]

export function createDefaultImportConfig(): ImportConfig {
    return {
        table_name: '',
        overwrite_existing: false,
        column_mappings: [],
        csv_delimiter: ',',
        csv_has_header: true,
        excel_sheet_index: 0,
        skip_rows: 0,
        batch_size: 1000,
    }
}

export function generateColumnMappings(
    preview: ImportPreview,
    _tableName: string,
): ColumnMapping[] {
    return preview.columns.map((col, index) => ({
        source_column: col,
        target_column: sanitizeColumnName(col),
        data_type: preview.suggested_types[col] || 'TEXT',
        is_primary_key: index === 0,
        nullable: true,
        default_value: undefined,
    }))
}

function sanitizeColumnName(name: string): string {
    let sanitized = name
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')

    if (/^\d/.test(sanitized)) {
        sanitized = '_' + sanitized
    }

    if (!sanitized) {
        sanitized = 'column'
    }

    return sanitized.toLowerCase()
}

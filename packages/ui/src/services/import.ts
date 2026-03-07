import { invoke } from '@tauri-apps/api/core'

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

export const importService = {
    async getSupportedFormats(): Promise<ImportFileInfo[]> {
        return invoke('get_supported_import_formats')
    },

    async parseImportFile(filePath: string, fileType: string): Promise<ImportPreview> {
        return invoke('parse_import_file', { filePath, fileType })
    },

    async detectColumnTypes(
        previewData: Record<string, string>[],
    ): Promise<Record<string, string>> {
        return invoke('detect_column_types', { previewData })
    },

    async executeImport(
        connectionId: string,
        config: ImportConfig,
        previewData: Record<string, string>[],
    ): Promise<ImportResult> {
        return invoke('execute_import', { connectionId, config, previewData })
    },

    async validateTableName(connectionId: string, tableName: string): Promise<boolean> {
        return invoke('validate_table_name', { connectionId, tableName })
    },
}

// SQLite 数据类型列表
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

// 默认导入配置
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

// 根据预览数据生成列映射
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

// 清理列名（移除特殊字符）
function sanitizeColumnName(name: string): string {
    // 移除特殊字符，替换空格为下划线
    let sanitized = name
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')

    // 确保不以数字开头
    if (/^\d/.test(sanitized)) {
        sanitized = '_' + sanitized
    }

    // 如果为空，使用默认名
    if (!sanitized) {
        sanitized = 'column'
    }

    return sanitized.toLowerCase()
}

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { DatabaseManager } from './database'
import { generateShortId } from './utils/id'
import { formatError } from './utils/errors'
import { quoteTableName } from './utils/sql'
import { WebViewLogger, logInfo, logError } from './logger'

// 命令参数验证器类型
type ParamValidator = (params: any) => boolean

interface CommandDefinition {
    handler: (params: any) => Promise<any>
    validator?: ParamValidator
}

export class SQLitePanel {
    public static currentPanel: SQLitePanel | undefined
    private static readonly viewType = 'sqliteClient'

    private readonly panel: vscode.WebviewPanel
    private readonly extensionUri: vscode.Uri
    private readonly databaseManager: DatabaseManager
    private disposables: vscode.Disposable[] = []
    private commandHandlers: Map<string, CommandDefinition> = new Map()

    public static createOrShow(
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager,
    ): SQLitePanel {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One

        if (SQLitePanel.currentPanel) {
            SQLitePanel.currentPanel.panel.reveal(column)
            return SQLitePanel.currentPanel
        }

        const panel = vscode.window.createWebviewPanel(
            SQLitePanel.viewType,
            'SQLite Client',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'media'),
                ],
            },
        )

        SQLitePanel.currentPanel = new SQLitePanel(panel, extensionUri, databaseManager)
        return SQLitePanel.currentPanel
    }

    /**
     * 绑定到现有的 WebviewPanel（用于 CustomEditor）
     */
    public static bindToWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager,
    ): SQLitePanel {
        logInfo('Binding to existing WebviewPanel')

        // 创建 SQLitePanel 实例（不设置 HTML，由调用者设置）
        const panel = new SQLitePanel(webviewPanel, extensionUri, databaseManager, false)
        SQLitePanel.currentPanel = panel

        return panel
    }

    private isWebviewReady = false
    private pendingMessages: any[] = []

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager,
        shouldUpdate: boolean = true,
    ) {
        this.panel = panel
        this.extensionUri = extensionUri
        this.databaseManager = databaseManager

        // 设置日志处理器
        WebViewLogger.setWebviewPanel(panel)
        logInfo('SQLitePanel initializing')

        this.registerCommandHandlers()
        if (shouldUpdate) {
            this.update()
        }

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

        this.panel.webview.onDidReceiveMessage(
            async message => {
                try {
                    // 处理日志消息
                    if (message.type === 'log') {
                        WebViewLogger.log(message.level, message.message, message.data)
                        return
                    }
                    // 处理 webview 就绪通知
                    if (message.type === 'webviewReady') {
                        logInfo('Webview is ready')
                        this.isWebviewReady = true
                        // 发送所有待处理的消息
                        for (const msg of this.pendingMessages) {
                            this.panel.webview.postMessage(msg)
                        }
                        this.pendingMessages = []
                        return
                    }
                    await this.handleMessage(message)
                } catch (error) {
                    logError('Message handler error', error)
                    this.panel.webview.postMessage({
                        id: message.id,
                        error: formatError(error),
                    })
                }
            },
            null,
            this.disposables,
        )
    }

    private registerCommandHandlers(): void {
        // 参数验证器
        const requireString = (field: string) => (params: any) =>
            typeof params?.[field] === 'string' && params[field].length > 0

        const requireConnectionId = requireString('connectionId')

        // 注册所有命令
        this.commandHandlers.set('create_connection', {
            validator: p => requireString('name')(p) && requireString('dbPath')(p),
            handler: p => this.databaseManager.createConnection(p.name, p.dbPath),
        })

        this.commandHandlers.set('create_new_database', {
            validator: p => requireString('name')(p) && requireString('dbPath')(p),
            handler: p => this.databaseManager.createNewDatabase(p.name, p.dbPath),
        })

        this.commandHandlers.set('close_connection', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.closeConnection(p.connectionId),
        })

        this.commandHandlers.set('list_connections', {
            handler: () => this.databaseManager.listConnections(),
        })

        this.commandHandlers.set('get_connection_info', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.getConnectionInfo(p.connectionId),
        })

        this.commandHandlers.set('test_connection', {
            validator: requireString('dbPath'),
            handler: p => this.databaseManager.testConnection(p.dbPath),
        })

        this.commandHandlers.set('execute_query', {
            validator: p => requireConnectionId(p) && requireString('sql')(p),
            handler: p => this.databaseManager.executeQuery(p.connectionId, p.sql, p.limit),
        })

        this.commandHandlers.set('list_tables', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.listTables(p.connectionId),
        })

        this.commandHandlers.set('get_table_schema', {
            validator: p => requireConnectionId(p) && requireString('tableName')(p),
            handler: p => this.databaseManager.getTableSchema(p.connectionId, p.tableName),
        })

        this.commandHandlers.set('get_database_schema', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.getDatabaseSchema(p.connectionId),
        })

        this.commandHandlers.set('list_indexes', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.listIndexes(p.connectionId),
        })

        this.commandHandlers.set('list_triggers', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.listTriggers(p.connectionId),
        })

        this.commandHandlers.set('get_er_diagram_data', {
            validator: requireConnectionId,
            handler: p => this.databaseManager.getERDiagramData(p.connectionId),
        })

        this.commandHandlers.set('get_table_data', {
            validator: p => requireConnectionId(p) && requireString('tableName')(p),
            handler: p =>
                this.databaseManager.getTableData(
                    p.connectionId,
                    p.tableName,
                    p.limit,
                    p.offset,
                    p.orderBy,
                    p.orderDir,
                ),
        })

        this.commandHandlers.set('insert_row', {
            validator: p =>
                requireConnectionId(p) &&
                requireString('tableName')(p) &&
                typeof p.data === 'object',
            handler: p => this.databaseManager.insertRow(p.connectionId, p.tableName, p.data),
        })

        this.commandHandlers.set('update_row', {
            validator: p =>
                requireConnectionId(p) &&
                requireString('tableName')(p) &&
                typeof p.data === 'object' &&
                typeof p.conditions === 'object',
            handler: p =>
                this.databaseManager.updateRow(p.connectionId, p.tableName, p.data, p.conditions),
        })

        this.commandHandlers.set('delete_row', {
            validator: p =>
                requireConnectionId(p) &&
                requireString('tableName')(p) &&
                typeof p.conditions === 'object',
            handler: p => this.databaseManager.deleteRow(p.connectionId, p.tableName, p.conditions),
        })

        this.commandHandlers.set('get_query_history', {
            handler: p => this.databaseManager.getQueryHistory(p?.limit, p?.offset),
        })

        this.commandHandlers.set('search_history', {
            validator: p => typeof p?.query === 'string',
            handler: p => this.databaseManager.searchHistory(p.query, p?.limit),
        })

        this.commandHandlers.set('delete_history_item', {
            validator: p => typeof p?.id === 'string',
            handler: p => this.databaseManager.deleteHistoryItem(p.id),
        })

        this.commandHandlers.set('clear_history', {
            handler: p => this.databaseManager.clearHistory(p?.connectionId),
        })

        this.commandHandlers.set('preview_create_table', {
            validator: p => typeof p?.table === 'object' && requireString('name')(p.table),
            handler: p => this.databaseManager.previewCreateTable(p.table),
        })

        this.commandHandlers.set('preview_alter_table', {
            validator: p =>
                requireConnectionId(p) && requireString('tableName')(p) && Array.isArray(p.changes),
            handler: p =>
                this.databaseManager.previewAlterTable(p.connectionId, p.tableName, p.changes),
        })

        this.commandHandlers.set('preview_drop_table', {
            validator: p => requireString('tableName')(p),
            handler: p => this.databaseManager.previewDropTable(p.tableName),
        })

        this.commandHandlers.set('create_table', {
            validator: p => requireConnectionId(p) && typeof p?.table === 'object',
            handler: p => this.databaseManager.createTable(p.connectionId, p.table),
        })

        this.commandHandlers.set('alter_table', {
            validator: p =>
                requireConnectionId(p) && requireString('tableName')(p) && Array.isArray(p.changes),
            handler: p => this.databaseManager.alterTable(p.connectionId, p.tableName, p.changes),
        })

        this.commandHandlers.set('drop_table', {
            validator: p => requireConnectionId(p) && requireString('tableName')(p),
            handler: p => this.databaseManager.dropTable(p.connectionId, p.tableName),
        })

        this.commandHandlers.set('execute_sql_file', {
            validator: p => requireConnectionId(p) && requireString('filePath')(p),
            handler: p => this.databaseManager.executeSqlFile(p.connectionId, p.filePath),
        })

        this.commandHandlers.set('show_save_dialog', {
            handler: async p => {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(p?.defaultPath || 'export.csv'),
                    filters: p?.filters || { 'CSV Files': ['csv'], 'All Files': ['*'] },
                })
                return saveUri?.fsPath
            },
        })

        this.commandHandlers.set('show_open_dialog', {
            handler: async p => {
                const openUris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: p?.filters || { 'SQL Files': ['sql'], 'All Files': ['*'] },
                })
                return openUris?.[0]?.fsPath
            },
        })

        this.commandHandlers.set('write_file', {
            validator: p => requireString('path')(p) && typeof p?.content === 'string',
            handler: async p => {
                fs.writeFileSync(p.path, p.content, p.encoding || 'utf-8')
                return true
            },
        })

        this.commandHandlers.set('read_file', {
            validator: requireString('path'),
            handler: async p => {
                return fs.readFileSync(p.path, p.encoding || 'utf-8')
            },
        })

        // Export commands
        this.commandHandlers.set('export_to_csv', {
            validator: p =>
                requireConnectionId(p) && requireString('sql')(p) && requireString('outputPath')(p),
            handler: async p => {
                // VS Code: 使用对话框让用户选择保存位置
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(p.outputPath),
                    filters: { 'CSV Files': ['csv'] },
                })
                if (!saveUri) throw new Error('Export cancelled')

                const result = await this.databaseManager.executeQuery(p.connectionId, p.sql, 10000)
                if (result.type !== 'rows') throw new Error('Query did not return rows')

                // 简单 CSV 导出
                const headers = result.columns.join(',')
                const rows = result.rows
                    .map(row =>
                        result.columns
                            .map(col => {
                                const val = row.values[col]
                                if (val?.type === 'Null') return ''
                                if (val?.type === 'Text')
                                    return `"${val.value?.replace(/"/g, '""')}"`
                                return val?.value ?? ''
                            })
                            .join(','),
                    )
                    .join('\n')

                fs.writeFileSync(saveUri.fsPath, `${headers}\n${rows}`)
                return true
            },
        })

        this.commandHandlers.set('export_to_json', {
            validator: p =>
                requireConnectionId(p) && requireString('sql')(p) && requireString('outputPath')(p),
            handler: async p => {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(p.outputPath),
                    filters: { 'JSON Files': ['json'] },
                })
                if (!saveUri) throw new Error('Export cancelled')

                const result = await this.databaseManager.executeQuery(p.connectionId, p.sql, 10000)
                if (result.type !== 'rows') throw new Error('Query did not return rows')

                const data = result.rows.map(row => {
                    const obj: Record<string, any> = {}
                    result.columns.forEach(col => {
                        const val = row.values[col]
                        obj[col] = val?.type === 'Null' ? null : val?.value
                    })
                    return obj
                })

                fs.writeFileSync(saveUri.fsPath, JSON.stringify(data, null, p.pretty ? 2 : 0))
                return true
            },
        })

        // Import commands
        this.commandHandlers.set('get_supported_import_formats', {
            handler: async () => [
                { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
                { extension: 'json', name: 'JSON', description: 'JSON Lines' },
            ],
        })

        this.commandHandlers.set('parse_import_file', {
            validator: p => requireString('filePath')(p) && requireString('fileType')(p),
            handler: async p => {
                const content = fs.readFileSync(p.filePath, 'utf-8')
                if (p.fileType === 'csv') {
                    const lines = content.split('\n').filter(l => l.trim())
                    const headers = lines[0].split(',').map(h => h.trim())
                    const rows = lines.slice(1, 11).map(line => {
                        const values = line.split(',')
                        const row: Record<string, string> = {}
                        headers.forEach((h, i) => {
                            row[h] = values[i]?.trim() ?? ''
                        })
                        return row
                    })
                    return {
                        columns: headers,
                        rows,
                        total_rows: lines.length - 1,
                        suggested_types: {},
                    }
                }
                throw new Error(`Unsupported file type: ${p.fileType}`)
            },
        })

        this.commandHandlers.set('execute_import', {
            validator: p =>
                requireConnectionId(p) &&
                typeof p.config === 'object' &&
                Array.isArray(p.previewData),
            handler: async p => {
                const conn = this.databaseManager.getConnection(p.connectionId)
                const { tableName, columns } = p.config

                // 创建表
                const columnDefs = columns
                    .map((col: any) => {
                        let def = `${col.name} ${col.type}`
                        if (col.notNull) def += ' NOT NULL'
                        if (col.primaryKey) def += ' PRIMARY KEY'
                        return def
                    })
                    .join(', ')

                const createSql = `CREATE TABLE IF NOT EXISTS ${quoteTableName(tableName)} (${columnDefs})`
                conn.db.exec(createSql)

                // 插入数据
                const insertColumns = columns.map((col: any) => col.name).join(', ')
                const placeholders = columns.map(() => '?').join(', ')
                const insertSql = `INSERT INTO ${quoteTableName(tableName)} (${insertColumns}) VALUES (${placeholders})`
                const insertStmt = conn.db.prepare(insertSql)

                let inserted = 0
                const transaction = conn.db.transaction(() => {
                    for (const row of p.previewData) {
                        const values = columns.map((col: any) => row[col.name])
                        insertStmt.run(values)
                        inserted++
                    }
                })
                transaction()

                return {
                    success: true,
                    table_name: tableName,
                    rows_imported: inserted,
                }
            },
        })

        this.commandHandlers.set('validate_table_name', {
            validator: p => requireConnectionId(p) && requireString('tableName')(p),
            handler: async p => {
                const conn = this.databaseManager.getConnection(p.connectionId)
                const result = conn.db
                    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
                    .get(p.tableName)
                return !result // 如果表不存在返回 true
            },
        })

        this.commandHandlers.set('export_query_to_file', {
            validator: p =>
                requireConnectionId(p) &&
                requireString('sql')(p) &&
                requireString('filePath')(p) &&
                requireString('format')(p),
            handler: async p => {
                const result = await this.databaseManager.executeQuery(
                    p.connectionId,
                    p.sql,
                    p.limit || 10000,
                )
                if (result.type !== 'rows') throw new Error('Query did not return rows')

                if (p.format === 'csv') {
                    const headers = result.columns.join(',')
                    const rows = result.rows
                        .map(row =>
                            result.columns
                                .map(col => {
                                    const val = row.values[col]
                                    if (val?.type === 'Null') return ''
                                    if (val?.type === 'Text')
                                        return `"${val.value?.replace(/"/g, '""')}"`
                                    return val?.value ?? ''
                                })
                                .join(','),
                        )
                        .join('\n')
                    fs.writeFileSync(p.filePath, `${headers}\n${rows}`, p.encoding || 'utf-8')
                } else if (p.format === 'json') {
                    const data = result.rows.map(row => {
                        const obj: Record<string, any> = {}
                        result.columns.forEach(col => {
                            const val = row.values[col]
                            obj[col] = val?.type === 'Null' ? null : val?.value
                        })
                        return obj
                    })
                    fs.writeFileSync(
                        p.filePath,
                        JSON.stringify(data, null, p.pretty ? 2 : 0),
                        p.encoding || 'utf-8',
                    )
                } else if (p.format === 'excel') {
                    // Excel 导出需要额外库，暂时返回错误
                    throw new Error('Excel export not supported in VS Code extension yet')
                }
                return true
            },
        })

        // Metadata commands
        this.commandHandlers.set('refresh_metadata', {
            validator: requireConnectionId,
            handler: async p => {
                const conn = await this.databaseManager.getConnectionInfo(p.connectionId)
                return conn.metadata
            },
        })

        this.commandHandlers.set('restore_saved_connections', {
            handler: async () => this.databaseManager.listConnections(),
        })

        this.commandHandlers.set('load_saved_connection_configs', {
            handler: async () =>
                this.databaseManager.listConnections().then(conns => conns.map(c => c.config)),
        })

        // Storage commands - 使用 VSCode globalState
        this.commandHandlers.set('storage_get', {
            handler: async p => {
                const value = this.context.globalState.get(`sqlite-client:${p.key}`)
                logInfo('Storage Get', { key: p.key, value })
                return value ?? null
            },
        })
        this.commandHandlers.set('storage_set', {
            handler: async p => {
                await this.context.globalState.update(`sqlite-client:${p.key}`, p.value)
                logInfo('Storage Set', { key: p.key, value: p.value })
                return true
            },
        })
        this.commandHandlers.set('storage_remove', {
            handler: async p => {
                await this.context.globalState.update(`sqlite-client:${p.key}`, undefined)
                logInfo('Storage Remove', { key: p.key })
                return true
            },
        })

        // Dialog commands - 使用 VSCode API
        this.commandHandlers.set('show_message', {
            handler: async p => {
                const message = p.message || ''
                const type = p.type || 'info'
                switch (type) {
                    case 'error':
                        await vscode.window.showErrorMessage(message)
                        break
                    case 'warning':
                        await vscode.window.showWarningMessage(message)
                        break
                    case 'info':
                    default:
                        await vscode.window.showInformationMessage(message)
                        break
                }
            },
        })
        this.commandHandlers.set('show_confirm', {
            handler: async p => {
                const message = p.message || 'Are you sure?'
                const result = await vscode.window.showQuickPick(['Yes', 'No'], {
                    placeHolder: message,
                })
                return result === 'Yes'
            },
        })
        this.commandHandlers.set('show_input', {
            handler: async p => {
                const result = await vscode.window.showInputBox({
                    prompt: p.prompt || 'Enter value',
                    value: p.defaultValue || '',
                })
                return result ?? null
            },
        })

        // CRUD log commands - 使用 globalState 存储
        this.commandHandlers.set('add_crud_log', {
            handler: async p => {
                const logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                logs.unshift({
                    ...p,
                    id: generateShortId(),
                    executed_at: new Date().toISOString(),
                })
                // 限制日志数量
                if (logs.length > 1000) {
                    logs.length = 1000
                }
                await this.context.globalState.update('sqlite-client:crud-logs', logs)
                return true
            },
        })
        this.commandHandlers.set('query_crud_logs', {
            handler: async p => {
                let logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                // 过滤
                if (p?.connection_id) {
                    logs = logs.filter(l => l.connection_id === p.connection_id)
                }
                if (p?.tab_id) {
                    logs = logs.filter(l => l.tab_id === p.tab_id)
                }
                if (p?.table_name) {
                    logs = logs.filter(l => l.table_name === p.table_name)
                }
                if (p?.operation_type) {
                    logs = logs.filter(l => l.operation_type === p.operation_type)
                }
                // 分页
                const offset = p?.offset || 0
                const limit = p?.limit || 100
                return logs.slice(offset, offset + limit)
            },
        })
        this.commandHandlers.set('count_crud_logs_by_tab', {
            handler: async p => {
                const logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                return logs.filter(l => l.tab_id === p?.tab_id).length
            },
        })
        this.commandHandlers.set('delete_crud_logs_by_tab', {
            handler: async p => {
                const logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                const newLogs = logs.filter(l => l.tab_id !== p?.tab_id)
                await this.context.globalState.update('sqlite-client:crud-logs', newLogs)
                return logs.length - newLogs.length
            },
        })
        this.commandHandlers.set('get_crud_log_table_names', {
            handler: async p => {
                const logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                const names = new Set<string>()
                logs.forEach(l => {
                    if (l.connection_id === p?.connection_id && l.table_name) {
                        names.add(l.table_name)
                    }
                })
                return Array.from(names)
            },
        })
        this.commandHandlers.set('get_crud_log_stats', {
            handler: async p => {
                let logs = this.context.globalState.get<any[]>('sqlite-client:crud-logs') || []
                if (p?.connection_id) {
                    logs = logs.filter(l => l.connection_id === p.connection_id)
                }
                const stats = {
                    total: logs.length,
                    success: logs.filter(l => l.is_success).length,
                    failed: logs.filter(l => !l.is_success).length,
                    inserts: logs.filter(l => l.operation_type === 'INSERT').length,
                    updates: logs.filter(l => l.operation_type === 'UPDATE').length,
                    deletes: logs.filter(l => l.operation_type === 'DELETE').length,
                }
                return stats
            },
        })

        // Stream query commands (not supported in VS Code, fallback to regular query)
        this.commandHandlers.set('execute_query_stream', {
            validator: p => requireConnectionId(p) && requireString('sql')(p),
            handler: async p => {
                // Fallback to regular query
                const result = await this.databaseManager.executeQuery(
                    p.connectionId,
                    p.sql,
                    p.batchSize || 1000,
                )
                return {
                    stream_id: 'stream-' + Date.now(),
                    total_rows: result.type === 'rows' ? result.rows.length : 0,
                    fetched_rows: result.type === 'rows' ? result.rows.length : 0,
                    has_more: result.type === 'rows' ? result.has_more : false,
                    columns: result.type === 'rows' ? result.columns : [],
                }
            },
        })

        this.commandHandlers.set('fetch_stream_batch', {
            handler: async () => [],
        })

        this.commandHandlers.set('cancel_query', {
            handler: async () => {},
        })
    }

    public openDatabase(dbPath: string): void {
        const message = {
            type: 'openDatabase',
            path: dbPath,
        }

        if (this.isWebviewReady) {
            this.panel.webview.postMessage(message)
        } else {
            logInfo('Webview not ready, queuing openDatabase message')
            this.pendingMessages.push(message)
        }
    }

    private async handleMessage(message: any): Promise<void> {
        const { id, command, params } = message

        if (!command || typeof command !== 'string') {
            throw new Error('Invalid message: command is required')
        }

        const commandDef = this.commandHandlers.get(command)
        if (!commandDef) {
            throw new Error(`Unknown command: ${command}`)
        }

        // 参数验证
        if (commandDef.validator && !commandDef.validator(params)) {
            throw new Error(`Invalid parameters for command: ${command}`)
        }

        const result = await commandDef.handler(params || {})

        this.panel.webview.postMessage({
            id,
            result,
        })
    }

    private update(): void {
        const webview = this.panel.webview
        this.panel.title = 'SQLite Client'
        webview.html = this.getHtmlForWebview(webview)
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // 使用构建后的静态 HTML 文件
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.html')

        try {
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8')

            // 基础资源路径
            const assetsBaseUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets'),
            )

            // 替换所有资源路径 - 使用正则替换所有匹配
            // 替换 ./assets/ 开头的路径为 webview 可访问的完整路径
            htmlContent = htmlContent.replace(
                /(['"])\.\/assets\//g,
                `$1${assetsBaseUri.toString()}/`,
            )

            // 添加 CSP 和 VSCode API
            const nonce = this.getNonce()
            const csp = [
                "default-src 'none'",
                `script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}`,
                `style-src ${webview.cspSource} 'unsafe-inline'`,
                `img-src ${webview.cspSource} data: blob:`,
                `font-src ${webview.cspSource}`,
                `connect-src ${webview.cspSource}`,
                "frame-src 'none'",
            ].join('; ')

            const vscodeScript = `
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <script nonce="${nonce}">
                    window.vscode = acquireVsCodeApi();
                </script>
                ${WebViewLogger.getInjectScript()}
            `

            // 添加 CSP 和 VSCode API 到 head
            htmlContent = htmlContent.replace('</head>', `${vscodeScript}</head>`)

            logInfo('Generated HTML with URIs', { baseUri: assetsBaseUri.toString() })

            return htmlContent
        } catch (error) {
            logError('Failed to read HTML file, using fallback', error)

            // 回退到动态生成的 HTML
            const scriptUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.js'),
            )
            const styleUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.css'),
            )

            const nonce = this.getNonce()

            // CSP 配置 - 放宽以支持 Monaco Editor 和其他动态加载
            const csp = [
                "default-src 'none'",
                `script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}`,
                `style-src 'nonce-${nonce}' 'unsafe-inline' ${webview.cspSource}`,
                `img-src ${webview.cspSource} data: blob:`,
                `font-src ${webview.cspSource}`,
                `connect-src ${webview.cspSource}`,
                "frame-src 'none'",
            ].join('; ')

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>SQLite Client</title>
    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
    </script>
    ${WebViewLogger.getInjectScript()}
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`
        }
    }

    private getNonce(): string {
        let text = ''
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length))
        }
        return text
    }

    dispose(): void {
        SQLitePanel.currentPanel = undefined
        WebViewLogger.dispose()
        this.panel.dispose()
        while (this.disposables.length) {
            const x = this.disposables.pop()
            if (x) {
                x.dispose()
            }
        }
    }
}

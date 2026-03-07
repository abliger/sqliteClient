import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { DatabaseManager } from './database'
import { generateShortId } from './utils/id'
import { formatError } from './utils/errors'

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

    public static createOrShow(extensionUri: vscode.Uri, databaseManager: DatabaseManager): SQLitePanel {
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
            }
        )

        SQLitePanel.currentPanel = new SQLitePanel(panel, extensionUri, databaseManager)
        return SQLitePanel.currentPanel
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager
    ) {
        this.panel = panel
        this.extensionUri = extensionUri
        this.databaseManager = databaseManager

        this.registerCommandHandlers()
        this.update()

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    await this.handleMessage(message)
                } catch (error) {
                    console.error('Message handler error:', error)
                    this.panel.webview.postMessage({
                        id: message.id,
                        error: formatError(error),
                    })
                }
            },
            null,
            this.disposables
        )
    }

    private registerCommandHandlers(): void {
        // 参数验证器
        const requireString = (field: string) => (params: any) => 
            typeof params?.[field] === 'string' && params[field].length > 0
        
        const requireConnectionId = requireString('connectionId')
        
        // 注册所有命令
        this.commandHandlers.set('create_connection', {
            validator: (p) => requireString('name')(p) && requireString('dbPath')(p),
            handler: (p) => this.databaseManager.createConnection(p.name, p.dbPath),
        })

        this.commandHandlers.set('create_new_database', {
            validator: (p) => requireString('name')(p) && requireString('dbPath')(p),
            handler: (p) => this.databaseManager.createNewDatabase(p.name, p.dbPath),
        })

        this.commandHandlers.set('close_connection', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.closeConnection(p.connectionId),
        })

        this.commandHandlers.set('list_connections', {
            handler: () => this.databaseManager.listConnections(),
        })

        this.commandHandlers.set('get_connection_info', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.getConnectionInfo(p.connectionId),
        })

        this.commandHandlers.set('test_connection', {
            validator: requireString('dbPath'),
            handler: (p) => this.databaseManager.testConnection(p.dbPath),
        })

        this.commandHandlers.set('execute_query', {
            validator: (p) => requireConnectionId(p) && requireString('sql')(p),
            handler: (p) => this.databaseManager.executeQuery(p.connectionId, p.sql, p.limit),
        })

        this.commandHandlers.set('list_tables', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.listTables(p.connectionId),
        })

        this.commandHandlers.set('get_table_schema', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p),
            handler: (p) => this.databaseManager.getTableSchema(p.connectionId, p.tableName),
        })

        this.commandHandlers.set('get_database_schema', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.getDatabaseSchema(p.connectionId),
        })

        this.commandHandlers.set('list_indexes', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.listIndexes(p.connectionId),
        })

        this.commandHandlers.set('list_triggers', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.listTriggers(p.connectionId),
        })

        this.commandHandlers.set('get_er_diagram_data', {
            validator: requireConnectionId,
            handler: (p) => this.databaseManager.getERDiagramData(p.connectionId),
        })

        this.commandHandlers.set('get_table_data', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p),
            handler: (p) => this.databaseManager.getTableData(
                p.connectionId,
                p.tableName,
                p.limit,
                p.offset,
                p.orderBy,
                p.orderDir
            ),
        })

        this.commandHandlers.set('insert_row', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p) && typeof p.data === 'object',
            handler: (p) => this.databaseManager.insertRow(p.connectionId, p.tableName, p.data),
        })

        this.commandHandlers.set('update_row', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p) && 
                           typeof p.data === 'object' && typeof p.conditions === 'object',
            handler: (p) => this.databaseManager.updateRow(p.connectionId, p.tableName, p.data, p.conditions),
        })

        this.commandHandlers.set('delete_row', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p) && typeof p.conditions === 'object',
            handler: (p) => this.databaseManager.deleteRow(p.connectionId, p.tableName, p.conditions),
        })

        this.commandHandlers.set('get_query_history', {
            handler: (p) => this.databaseManager.getQueryHistory(p?.limit, p?.offset),
        })

        this.commandHandlers.set('search_history', {
            validator: (p) => typeof p?.query === 'string',
            handler: (p) => this.databaseManager.searchHistory(p.query, p?.limit),
        })

        this.commandHandlers.set('delete_history_item', {
            validator: (p) => typeof p?.id === 'string',
            handler: (p) => this.databaseManager.deleteHistoryItem(p.id),
        })

        this.commandHandlers.set('clear_history', {
            handler: (p) => this.databaseManager.clearHistory(p?.connectionId),
        })

        this.commandHandlers.set('preview_create_table', {
            validator: (p) => typeof p?.table === 'object' && requireString('name')(p.table),
            handler: (p) => this.databaseManager.previewCreateTable(p.table),
        })

        this.commandHandlers.set('preview_alter_table', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p) && Array.isArray(p.changes),
            handler: (p) => this.databaseManager.previewAlterTable(p.connectionId, p.tableName, p.changes),
        })

        this.commandHandlers.set('preview_drop_table', {
            validator: (p) => requireString('tableName')(p),
            handler: (p) => this.databaseManager.previewDropTable(p.tableName),
        })

        this.commandHandlers.set('create_table', {
            validator: (p) => requireConnectionId(p) && typeof p?.table === 'object',
            handler: (p) => this.databaseManager.createTable(p.connectionId, p.table),
        })

        this.commandHandlers.set('alter_table', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p) && Array.isArray(p.changes),
            handler: (p) => this.databaseManager.alterTable(p.connectionId, p.tableName, p.changes),
        })

        this.commandHandlers.set('drop_table', {
            validator: (p) => requireConnectionId(p) && requireString('tableName')(p),
            handler: (p) => this.databaseManager.dropTable(p.connectionId, p.tableName),
        })

        this.commandHandlers.set('execute_sql_file', {
            validator: (p) => requireConnectionId(p) && requireString('filePath')(p),
            handler: (p) => this.databaseManager.executeSqlFile(p.connectionId, p.filePath),
        })

        this.commandHandlers.set('show_save_dialog', {
            handler: async (p) => {
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(p?.defaultPath || 'export.csv'),
                    filters: p?.filters || { 'CSV Files': ['csv'], 'All Files': ['*'] },
                })
                return saveUri?.fsPath
            },
        })

        this.commandHandlers.set('show_open_dialog', {
            handler: async (p) => {
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
            validator: (p) => requireString('path')(p) && typeof p?.content === 'string',
            handler: async (p) => {
                fs.writeFileSync(p.path, p.content, p.encoding || 'utf-8')
                return true
            },
        })

        this.commandHandlers.set('read_file', {
            validator: requireString('path'),
            handler: async (p) => {
                return fs.readFileSync(p.path, p.encoding || 'utf-8')
            },
        })
    }

    public openDatabase(dbPath: string): void {
        this.panel.webview.postMessage({
            type: 'openDatabase',
            path: dbPath,
        })
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
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'main.js')
        )
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'style.css')
        )

        const nonce = this.getNonce()
        
        // 增强的 CSP 配置
        const csp = [
            "default-src 'none'",
            `script-src 'nonce-${nonce}'`,
            `style-src 'unsafe-inline' ${webview.cspSource}`,
            `img-src ${webview.cspSource} data: blob:`,
            `font-src ${webview.cspSource}`,
            "connect-src 'none'",
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
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`
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
        this.panel.dispose()
        while (this.disposables.length) {
            const x = this.disposables.pop()
            if (x) {
                x.dispose()
            }
        }
    }
}

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { DatabaseManager } from './database'

export class SQLitePanel {
    public static currentPanel: SQLitePanel | undefined
    private static readonly viewType = 'sqliteClient'

    private readonly panel: vscode.WebviewPanel
    private readonly extensionUri: vscode.Uri
    private readonly databaseManager: DatabaseManager
    private disposables: vscode.Disposable[] = []

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

        this.update()

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    await this.handleMessage(message)
                } catch (error) {
                    this.panel.webview.postMessage({
                        id: message.id,
                        error: String(error),
                    })
                }
            },
            null,
            this.disposables
        )
    }

    public openDatabase(dbPath: string) {
        this.panel.webview.postMessage({
            type: 'openDatabase',
            path: dbPath,
        })
    }

    private async handleMessage(message: any) {
        const { id, command, params } = message

        let result: any
        switch (command) {
            case 'create_connection':
                result = await this.databaseManager.createConnection(params.name, params.dbPath)
                break
            case 'create_new_database':
                result = await this.databaseManager.createNewDatabase(params.name, params.dbPath)
                break
            case 'close_connection':
                result = await this.databaseManager.closeConnection(params.connectionId)
                break
            case 'list_connections':
                result = await this.databaseManager.listConnections()
                break
            case 'get_connection_info':
                result = await this.databaseManager.getConnectionInfo(params.connectionId)
                break
            case 'test_connection':
                result = await this.databaseManager.testConnection(params.dbPath)
                break
            case 'execute_query':
                result = await this.databaseManager.executeQuery(
                    params.connectionId,
                    params.sql,
                    params.limit
                )
                break
            case 'list_tables':
                result = await this.databaseManager.listTables(params.connectionId)
                break
            case 'get_table_schema':
                result = await this.databaseManager.getTableSchema(
                    params.connectionId,
                    params.tableName
                )
                break
            case 'get_database_schema':
                result = await this.databaseManager.getDatabaseSchema(params.connectionId)
                break
            case 'list_indexes':
                result = await this.databaseManager.listIndexes(params.connectionId)
                break
            case 'list_triggers':
                result = await this.databaseManager.listTriggers(params.connectionId)
                break
            case 'get_er_diagram_data':
                result = await this.databaseManager.getERDiagramData(params.connectionId)
                break
            case 'get_table_data':
                result = await this.databaseManager.getTableData(
                    params.connectionId,
                    params.tableName,
                    params.limit,
                    params.offset,
                    params.orderBy,
                    params.orderDir
                )
                break
            case 'insert_row':
                result = await this.databaseManager.insertRow(
                    params.connectionId,
                    params.tableName,
                    params.data
                )
                break
            case 'update_row':
                result = await this.databaseManager.updateRow(
                    params.connectionId,
                    params.tableName,
                    params.data,
                    params.conditions
                )
                break
            case 'delete_row':
                result = await this.databaseManager.deleteRow(
                    params.connectionId,
                    params.tableName,
                    params.conditions
                )
                break
            case 'get_query_history':
                result = await this.databaseManager.getQueryHistory(params.limit, params.offset)
                break
            case 'search_history':
                result = await this.databaseManager.searchHistory(params.query, params.limit)
                break
            case 'delete_history_item':
                result = await this.databaseManager.deleteHistoryItem(params.id)
                break
            case 'clear_history':
                result = await this.databaseManager.clearHistory(params.connectionId)
                break
            case 'preview_create_table':
                result = await this.databaseManager.previewCreateTable(params.table)
                break
            case 'preview_alter_table':
                result = await this.databaseManager.previewAlterTable(
                    params.connectionId,
                    params.tableName,
                    params.changes
                )
                break
            case 'preview_drop_table':
                result = await this.databaseManager.previewDropTable(params.tableName)
                break
            case 'create_table':
                result = await this.databaseManager.createTable(params.connectionId, params.table)
                break
            case 'alter_table':
                result = await this.databaseManager.alterTable(
                    params.connectionId,
                    params.tableName,
                    params.changes
                )
                break
            case 'drop_table':
                result = await this.databaseManager.dropTable(params.connectionId, params.tableName)
                break
            case 'execute_sql_file':
                result = await this.databaseManager.executeSqlFile(params.connectionId, params.filePath)
                break
            case 'show_save_dialog':
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(params.defaultPath || 'export.csv'),
                    filters: params.filters || { 'CSV Files': ['csv'], 'All Files': ['*'] },
                })
                result = saveUri?.fsPath
                break
            case 'show_open_dialog':
                const openUris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: params.filters || { 'SQL Files': ['sql'], 'All Files': ['*'] },
                })
                result = openUris?.[0]?.fsPath
                break
            case 'write_file':
                fs.writeFileSync(params.path, params.content, params.encoding || 'utf-8')
                result = true
                break
            case 'read_file':
                result = fs.readFileSync(params.path, params.encoding || 'utf-8')
                break
            default:
                throw new Error(`Unknown command: ${command}`)
        }

        this.panel.webview.postMessage({
            id,
            result,
        })
    }

    private update() {
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

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
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

    dispose() {
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

import * as vscode from 'vscode'
import { SQLitePanel } from './webview-panel'
import { DatabaseManager } from './database'

export function activate(context: vscode.ExtensionContext) {
    console.log('SQLite Client extension is now active')

    const databaseManager = new DatabaseManager({
        maxHistorySize: 1000,
        maxQueryResults: 10000,
    })

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqliteClient.open', () => {
            try {
                SQLitePanel.createOrShow(context.extensionUri, databaseManager)
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open SQLite Client: ${error}`)
            }
        }),

        vscode.commands.registerCommand('sqliteClient.openDatabase', async (uri?: vscode.Uri) => {
            try {
                let dbPath: string | undefined

                if (uri?.fsPath) {
                    dbPath = uri.fsPath
                } else {
                    const result = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'SQLite Databases': ['db', 'sqlite', 'sqlite3'],
                            'All Files': ['*'],
                        },
                    })
                    if (result && result[0]) {
                        dbPath = result[0].fsPath
                    }
                }

                if (dbPath) {
                    const panel = SQLitePanel.createOrShow(context.extensionUri, databaseManager)
                    panel.openDatabase(dbPath)
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open database: ${error}`)
            }
        }),

        vscode.commands.registerCommand('sqliteClient.closeConnection', async () => {
            // Close connection logic will be handled by the panel
            // This command can be invoked from the UI or command palette
            const panel = SQLitePanel.currentPanel
            if (panel) {
                // Panel will handle the close logic
            }
        })
    )

    // Clean up on deactivation
    context.subscriptions.push({
        dispose: () => {
            try {
                databaseManager.dispose()
            } catch (error) {
                console.error('Error disposing database manager:', error)
            }
        },
    })
}

export function deactivate() {
    console.log('SQLite Client extension is now deactivated')
}

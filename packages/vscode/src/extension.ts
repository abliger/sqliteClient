import * as vscode from 'vscode'
import { SQLitePanel } from './webview-panel'
import { DatabaseManager } from './database'

export function activate(context: vscode.ExtensionContext) {
    console.log('SQLite Client extension is now active')

    const databaseManager = new DatabaseManager()

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqliteClient.open', () => {
            SQLitePanel.createOrShow(context.extensionUri, databaseManager)
        }),

        vscode.commands.registerCommand('sqliteClient.openDatabase', async (uri?: vscode.Uri) => {
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
        }),

        vscode.commands.registerCommand('sqliteClient.closeConnection', async () => {
            // Close connection logic will be handled by the panel
        })
    )

    // Clean up on deactivation
    context.subscriptions.push({
        dispose: () => {
            databaseManager.dispose()
        },
    })
}

export function deactivate() {
    console.log('SQLite Client extension is now deactivated')
}

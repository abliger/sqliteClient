import * as vscode from 'vscode'
import { SQLitePanel } from './webview-panel'
import { DatabaseManager } from './database'

let databaseManager: DatabaseManager | null = null

function getDatabaseManager(): DatabaseManager {
    if (!databaseManager) {
        databaseManager = new DatabaseManager({
            maxHistorySize: 1000,
            maxQueryResults: 10000,
        })
    }
    return databaseManager
}

export function activate(context: vscode.ExtensionContext) {
    console.log('SQLite Client extension is now active')

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqliteClient.open', () => {
            try {
                const manager = getDatabaseManager()
                SQLitePanel.createOrShow(context.extensionUri, manager)
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open SQLite Client: ${error}`)
                console.error('Failed to open SQLite Client:', error)
            }
        }),

        vscode.commands.registerCommand('sqliteClient.openDatabase', async (uri?: vscode.Uri) => {
            try {
                const manager = getDatabaseManager()
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
                    const panel = SQLitePanel.createOrShow(context.extensionUri, manager)
                    panel.openDatabase(dbPath)
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open database: ${error}`)
                console.error('Failed to open database:', error)
            }
        }),

        vscode.commands.registerCommand('sqliteClient.closeConnection', async () => {
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
                databaseManager?.dispose()
                databaseManager = null
            } catch (error) {
                console.error('Error disposing database manager:', error)
            }
        },
    })
}

export function deactivate() {
    console.log('SQLite Client extension is now deactivated')
    try {
        databaseManager?.dispose()
        databaseManager = null
    } catch (error) {
        console.error('Error during deactivation:', error)
    }
}

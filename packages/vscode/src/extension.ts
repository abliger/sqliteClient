import * as vscode from 'vscode'
import { SQLitePanel } from './webview-panel'
import { DatabaseManager } from './database'
import { SQLiteEditorProvider } from './editor-provider'

let databaseManager: DatabaseManager | null = null
let editorProvider: SQLiteEditorProvider | null = null

function getDatabaseManager(context: vscode.ExtensionContext): DatabaseManager {
    if (!databaseManager) {
        databaseManager = new DatabaseManager(context, {
            maxHistorySize: 1000,
            maxQueryResults: 10000,
        })
    }
    return databaseManager
}

function getEditorProvider(context: vscode.ExtensionContext): SQLiteEditorProvider {
    if (!editorProvider) {
        editorProvider = SQLiteEditorProvider.getInstance(
            context.extensionUri,
            getDatabaseManager(context)
        )
    }
    return editorProvider
}

export function activate(context: vscode.ExtensionContext) {
    console.log('SQLite Client extension is now active')

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('sqliteClient.open', () => {
            try {
                const manager = getDatabaseManager(context)
                SQLitePanel.createOrShow(context.extensionUri, manager)
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open SQLite Client: ${error}`)
                console.error('Failed to open SQLite Client:', error)
            }
        }),

        vscode.commands.registerCommand('sqliteClient.openDatabase', async (uri?: vscode.Uri) => {
            try {
                const manager = getDatabaseManager(context)
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

    // Register custom editor provider (双击打开功能)
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'sqliteClient.editor',
            getEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    )

    // Clean up on deactivation
    context.subscriptions.push({
        dispose: () => {
            try {
                databaseManager?.dispose()
                databaseManager = null
                editorProvider = null
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

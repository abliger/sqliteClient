import * as vscode from 'vscode'
import { DatabaseManager } from './database'
import { SQLitePanel } from './webview-panel'

/**
 * 自定义编辑器提供者
 * 实现双击打开 SQLite 文件功能
 */
export class SQLiteEditorProvider implements vscode.CustomEditorProvider<vscode.CustomDocument> {
    private static instance: SQLiteEditorProvider | undefined
    
    constructor(
        private extensionUri: vscode.Uri,
        private databaseManager: DatabaseManager
    ) {}

    /**
     * 获取单例实例
     */
    public static getInstance(
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager
    ): SQLiteEditorProvider {
        if (!SQLiteEditorProvider.instance) {
            SQLiteEditorProvider.instance = new SQLiteEditorProvider(extensionUri, databaseManager)
        }
        return SQLiteEditorProvider.instance
    }

    /**
     * 自定义编辑器事件
     */
    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>()
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event

    /**
     * 打开自定义文档
     * 当用户双击 SQLite 文件时触发
     */
    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        console.log('[SQLiteEditorProvider] Opening document:', uri.fsPath)
        
        // 返回一个简单的文档对象
        return {
            uri,
            dispose: () => {
                console.log('[SQLiteEditorProvider] Disposing document:', uri.fsPath)
            },
        }
    }

    /**
     * 解析自定义编辑器
     * 创建 WebView 面板并加载 SQLite Client UI
     */
    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const dbPath = document.uri.fsPath
        console.log('[SQLiteEditorProvider] Resolving custom editor for:', dbPath)

        try {
            // 使用现有的 SQLitePanel 创建 WebView
            const panel = SQLitePanel.createOrShow(this.extensionUri, this.databaseManager)
            
            // 打开数据库文件
            panel.openDatabase(dbPath)
            
            // 当 WebView 面板关闭时清理
            webviewPanel.onDidDispose(() => {
                console.log('[SQLiteEditorProvider] WebView panel disposed')
            })
        } catch (error) {
            console.error('[SQLiteEditorProvider] Failed to open database:', error)
            vscode.window.showErrorMessage(`无法打开数据库: ${error}`)
            throw error
        }
    }

    /**
     * 保存自定义文档
     */
    async saveCustomDocument(
        _document: vscode.CustomDocument,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        // SQLite 数据库是实时保存的，不需要额外操作
        console.log('[SQLiteEditorProvider] Save document (no-op for SQLite)')
    }

    /**
     * 另存为自定义文档
     */
    async saveCustomDocumentAs(
        _document: vscode.CustomDocument,
        _destination: vscode.Uri,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        // 不支持另存为操作
        throw new Error('不支持另存为 SQLite 数据库')
    }

    /**
     * 恢复自定义文档
     */
    async revertCustomDocument(
        _document: vscode.CustomDocument,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        // 不需要恢复操作
        console.log('[SQLiteEditorProvider] Revert document (no-op)')
    }

    /**
     * 备份自定义文档
     */
    async backupCustomDocument(
        _document: vscode.CustomDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        return {
            id: context.destination.toString(),
            delete: () => {
                console.log('[SQLiteEditorProvider] Backup deleted')
            },
        }
    }
}

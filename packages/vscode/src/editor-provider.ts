import * as vscode from 'vscode'
import * as fs from 'fs'
import { DatabaseManager } from './database'
import { SQLitePanel } from './webview-panel'
import { WebViewLogger, logInfo, logError } from './logger'

/**
 * 自定义编辑器提供者
 * 实现双击打开 SQLite 文件功能
 */
export class SQLiteEditorProvider implements vscode.CustomEditorProvider<vscode.CustomDocument> {
    private static instance: SQLiteEditorProvider | undefined

    constructor(
        private extensionUri: vscode.Uri,
        private databaseManager: DatabaseManager,
    ) {}

    /**
     * 获取单例实例
     */
    public static getInstance(
        extensionUri: vscode.Uri,
        databaseManager: DatabaseManager,
    ): SQLiteEditorProvider {
        if (!SQLiteEditorProvider.instance) {
            SQLiteEditorProvider.instance = new SQLiteEditorProvider(extensionUri, databaseManager)
        }
        return SQLiteEditorProvider.instance
    }

    /**
     * 自定义编辑器事件
     */
    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
        vscode.CustomDocumentEditEvent<vscode.CustomDocument>
    >()
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event

    /**
     * 打开自定义文档
     * 当用户双击 SQLite 文件时触发
     */
    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        logInfo('Opening document', { path: uri.fsPath })

        // 返回一个简单的文档对象
        return {
            uri,
            dispose: () => {
                logInfo('Disposing document', { path: uri.fsPath })
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
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const dbPath = document.uri.fsPath
        logInfo('Resolving custom editor', { path: dbPath })

        try {
            // 配置 webview 选项（必须在设置 HTML 之前）
            webviewPanel.webview.options = {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
                    vscode.Uri.joinPath(this.extensionUri, 'media'),
                ],
            }

            // 设置标题
            webviewPanel.title = 'SQLite Client'

            // 设置日志处理器
            WebViewLogger.setWebviewPanel(webviewPanel)

            // 生成 HTML 并设置
            const html = this.getHtmlForWebview(webviewPanel.webview)
            logInfo('Setting HTML', { length: html.length })
            webviewPanel.webview.html = html

            // 创建面板控制器
            const panel = SQLitePanel.bindToWebviewPanel(
                webviewPanel,
                this.extensionUri,
                this.databaseManager,
            )

            // 打开数据库文件
            panel.openDatabase(dbPath)
            logInfo('Database open request sent')
        } catch (error) {
            logError('Failed to open database', error)
            vscode.window.showErrorMessage(`无法打开数据库: ${error}`)
            throw error
        }
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

            // 添加 CSP 和 VSCode API
            return htmlContent.replace('</head>', `${vscodeScript}</head>`)
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

            // CSP 配置
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

    /**
     * 保存自定义文档
     */
    async saveCustomDocument(
        _document: vscode.CustomDocument,
        _cancellation: vscode.CancellationToken,
    ): Promise<void> {
        // SQLite 数据库是实时保存的，不需要额外操作
        logInfo('Save document (no-op for SQLite)')
    }

    /**
     * 另存为自定义文档
     */
    async saveCustomDocumentAs(
        _document: vscode.CustomDocument,
        _destination: vscode.Uri,
        _cancellation: vscode.CancellationToken,
    ): Promise<void> {
        // 不支持另存为操作
        throw new Error('不支持另存为 SQLite 数据库')
    }

    /**
     * 恢复自定义文档
     */
    async revertCustomDocument(
        _document: vscode.CustomDocument,
        _cancellation: vscode.CancellationToken,
    ): Promise<void> {
        // 不需要恢复操作
        logInfo('Revert document (no-op)')
    }

    /**
     * 备份自定义文档
     */
    async backupCustomDocument(
        _document: vscode.CustomDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken,
    ): Promise<vscode.CustomDocumentBackup> {
        return {
            id: context.destination.toString(),
            delete: () => {
                logInfo('Backup deleted')
            },
        }
    }
}

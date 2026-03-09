/**
 * VSCode Output Channel Logger
 * 管理 WebView 日志输出到 VSCode Output 面板
 */
import * as vscode from 'vscode'

export class WebViewLogger {
    private static outputChannel: vscode.OutputChannel | null = null
    private static webviewPanel: vscode.WebviewPanel | null = null

    /**
     * 获取或创建 Output Channel
     */
    static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('SQLite Client', 'log')
        }
        return this.outputChannel
    }

    /**
     * 设置 WebViewPanel 用于接收消息
     */
    static setWebviewPanel(panel: vscode.WebviewPanel) {
        this.webviewPanel = panel

        // 监听来自 WebView 的日志消息
        panel.webview.onDidReceiveMessage(message => {
            if (message.type === 'log') {
                this.log(message.level, message.message, message.data)
            }
        })
    }

    /**
     * 记录日志
     */
    static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
        const channel = this.getOutputChannel()
        const timestamp = new Date().toISOString()
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`

        let output = `${prefix} ${message}`
        if (data !== undefined) {
            if (typeof data === 'object') {
                try {
                    output += ` ${JSON.stringify(data, null, 2)}`
                } catch {
                    output += ` [Object]`
                }
            } else {
                output += ` ${data}`
            }
        }

        channel.appendLine(output)

        // 错误级别自动显示 Output 面板
        if (level === 'error') {
            channel.show(true)
        }
    }

    /**
     * 获取注入到 WebView 的脚本
     */
    static getInjectScript(): string {
        return `
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // 保存原始的 console 方法
                    const originalConsole = {
                        log: console.log,
                        info: console.info,
                        warn: console.warn,
                        error: console.error,
                        debug: console.debug
                    };
                    
                    // 格式化参数
                    function formatArgs(args) {
                        return args.map(arg => {
                            if (typeof arg === 'object' && arg !== null) {
                                try {
                                    return JSON.stringify(arg);
                                } catch (e) {
                                    return '[Circular]';
                                }
                            }
                            return String(arg);
                        }).join(' ');
                    }
                    
                    // 发送日志到 VSCode
                    function sendLog(level, args) {
                        const message = formatArgs(args);
                        vscode.postMessage({
                            type: 'log',
                            level: level,
                            message: message,
                            data: args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined
                        });
                    }
                    
                    // 重写 console 方法
                    console.log = function(...args) {
                        originalConsole.log.apply(console, args);
                        sendLog('info', args);
                    };
                    
                    console.info = function(...args) {
                        originalConsole.info.apply(console, args);
                        sendLog('info', args);
                    };
                    
                    console.warn = function(...args) {
                        originalConsole.warn.apply(console, args);
                        sendLog('warn', args);
                    };
                    
                    console.error = function(...args) {
                        originalConsole.error.apply(console, args);
                        sendLog('error', args);
                    };
                    
                    console.debug = function(...args) {
                        originalConsole.debug.apply(console, args);
                        sendLog('debug', args);
                    };
                    
                    console.log('[SQLite Client] Console redirect initialized');
                })();
            </script>
        `
    }

    /**
     * 显示 Output 面板
     */
    static show() {
        this.getOutputChannel().show(true)
    }

    /**
     * 清空日志
     */
    static clear() {
        this.getOutputChannel().clear()
    }

    /**
     * 销毁资源
     */
    static dispose() {
        this.outputChannel?.dispose()
        this.outputChannel = null
        this.webviewPanel = null
    }
}

// 便捷的日志函数
export function logInfo(message: string, data?: any) {
    WebViewLogger.log('info', message, data)
}

export function logWarn(message: string, data?: any) {
    WebViewLogger.log('warn', message, data)
}

export function logError(message: string, data?: any) {
    WebViewLogger.log('error', message, data)
}

export function logDebug(message: string, data?: any) {
    WebViewLogger.log('debug', message, data)
}

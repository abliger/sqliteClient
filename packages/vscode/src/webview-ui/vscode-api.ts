// VSCode API adapter - replaces Tauri API for webview context
import { generateShortId } from '../../utils/id'

declare global {
    interface Window {
        vscode: {
            postMessage(message: any): void
            getState(): any
            setState(state: any): void
        }
    }
}

// 消息处理器的存储
const messageHandlers = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
}>()

// 全局消息监听（只注册一次）
let isListenerRegistered = false

function registerGlobalListener(): void {
    if (isListenerRegistered) return
    isListenerRegistered = true

    window.addEventListener('message', (event) => {
        const message = event.data
        if (!message?.id) return

        const handler = messageHandlers.get(message.id)
        if (!handler) return

        // 清理 handler
        clearTimeout(handler.timeout)
        messageHandlers.delete(message.id)

        if (message.error) {
            handler.reject(new Error(message.error))
        } else {
            handler.resolve(message.result)
        }
    })
}

// Invoke function that mimics Tauri's invoke API
export async function invoke<T>(command: string, params?: Record<string, any>): Promise<T> {
    registerGlobalListener()

    return new Promise((resolve, reject) => {
        const id = generateShortId()

        // 设置超时
        const timeout = setTimeout(() => {
            messageHandlers.delete(id)
            reject(new Error(`Command "${command}" timed out after 30 seconds`))
        }, 30000)

        messageHandlers.set(id, { resolve, reject, timeout })

        try {
            window.vscode.postMessage({ id, command, params })
        } catch (error) {
            clearTimeout(timeout)
            messageHandlers.delete(id)
            reject(error)
        }
    })
}

// Mock Tauri API modules
export const mockTauriAPI = {
    core: {
        invoke,
    },
}

// Make it available globally for UI package imports
;(window as any).__TAURI__ = mockTauriAPI

// 清理函数（用于测试）
export function cleanupMessageHandlers(): void {
    for (const [id, handler] of messageHandlers) {
        clearTimeout(handler.timeout)
        handler.reject(new Error('Message handler cleaned up'))
    }
    messageHandlers.clear()
}

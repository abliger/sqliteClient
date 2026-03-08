import type { invoke as InvokeFn } from '@tauri-apps/api/core'

declare global {
    interface Window {
        __TAURI_INTERNALS__?: {
            invoke: typeof InvokeFn
        }
        vscode?: {
            postMessage: (message: any) => void
        }
    }
}

/**
 * 检测是否在 Tauri 环境中运行
 */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && 
           window.__TAURI_INTERNALS__ !== undefined
}

/**
 * 检测是否在 VSCode WebView 环境中运行
 * 注意：这个检测应该在 DOM 加载完成后使用
 */
export function isVSCode(): boolean {
    return typeof window !== 'undefined' && 
           window.vscode !== undefined
}

/**
 * 检测是否支持文件对话框（Tauri 桌面应用或 VSCode 扩展）
 * 这是一个运行时检查，可以在任何时候调用
 */
export function isDialogSupported(): boolean {
    if (typeof window === 'undefined') return false
    // 检查 Tauri 环境
    if (window.__TAURI_INTERNALS__ !== undefined) return true
    // 检查 VSCode WebView 环境
    if (window.vscode !== undefined) return true
    return false
}

/**
 * 安全的 invoke 调用 - 在浏览器环境中返回默认值
 */
export async function safeInvoke<T>(
    cmd: string,
    args?: Record<string, unknown>,
    defaultValue?: T
): Promise<T | undefined> {
    if (!isTauri()) {
        console.warn(`[Tauri] Not in Tauri environment, skipping invoke: ${cmd}`)
        return defaultValue
    }
    
    // 动态导入避免在浏览器中加载失败
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
}

/**
 * 创建仅在 Tauri 环境中运行的函数包装器
 */
export function createTauriOnlyFn<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    fallbackMessage?: string
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
        if (!isTauri()) {
            if (fallbackMessage) {
                console.warn(`[Tauri] ${fallbackMessage}`)
            }
            return undefined
        }
        return fn(...args) as ReturnType<T>
    }
}

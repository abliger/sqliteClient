/**
 * VS Code WebView Bridge
 * 通用消息发送和响应处理
 */
import { isVSCode } from '@utils/tauri'

let messageId = 0
const pendingMessages = new Map<string, { 
    resolve: (value: unknown) => void 
    reject: (reason: Error) => void 
}>()

// 监听来自扩展主机的响应
if (typeof window !== 'undefined' && isVSCode()) {
    window.addEventListener('message', (event) => {
        const message = event.data
        if (message?.id && pendingMessages.has(message.id)) {
            const { resolve, reject } = pendingMessages.get(message.id)!
            pendingMessages.delete(message.id)
            
            if (message.error) {
                reject(new Error(message.error))
            } else {
                resolve(message.result)
            }
        }
    })
}

/**
 * 向 VS Code 扩展发送消息并等待响应
 */
export function postVSCodeMessage<T>(command: string, params?: Record<string, unknown>): Promise<T> {
    if (!isVSCode()) {
        throw new Error('Not in VS Code environment')
    }
    
    const id = `${Date.now()}-${++messageId}`
    
    return new Promise((resolve, reject) => {
        pendingMessages.set(id, { 
            resolve: resolve as (value: unknown) => void, 
            reject 
        })
        
        window.vscode!.postMessage({
            id,
            command,
            params
        })
        
        // 30秒超时
        setTimeout(() => {
            if (pendingMessages.has(id)) {
                pendingMessages.delete(id)
                reject(new Error(`Request timeout: ${command}`))
            }
        }, 30000)
    })
}

/**
 * 创建支持 VS Code 的 service wrapper
 * 自动检测环境并使用正确的 API
 */
export function createVSCodeService<T extends Record<string, Function>>(
    tauriService: T,
    commandMap: Record<keyof T, string>
): T {
    return new Proxy({} as T, {
        get(target, prop: string) {
            // 如果不在 VS Code 环境，返回原始 Tauri 服务
            if (!isVSCode()) {
                return tauriService[prop as keyof T]
            }
            
            // 如果在 VS Code 环境，返回包装函数
            return async (...args: unknown[]) => {
                const command = commandMap[prop as keyof T]
                if (!command) {
                    throw new Error(`Unknown command: ${prop}`)
                }
                
                // 获取函数的参数名（用于构建 params 对象）
                const fn = tauriService[prop as keyof T] as Function
                const paramNames = getParamNames(fn)
                
                // 构建参数对象
                const params: Record<string, unknown> = {}
                paramNames.forEach((name, index) => {
                    params[name] = args[index]
                })
                
                return postVSCodeMessage(command, params)
            }
        }
    })
}

// 获取函数参数名的辅助函数
function getParamNames(fn: Function): string[] {
    const fnStr = fn.toString()
    const result = fnStr.match(/\(([^)]*)\)/)
    if (!result) return []
    
    return result[1]
        .split(',')
        .map(p => p.trim().split(/[=\s]/)[0])
        .filter(p => p)
}

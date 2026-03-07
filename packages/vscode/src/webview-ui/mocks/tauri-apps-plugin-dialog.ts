// Mock for @tauri-apps/plugin-dialog
import { generateShortId } from '../../utils/id'

export interface DialogFilter {
    name: string
    extensions: string[]
}

export interface OpenDialogOptions {
    title?: string
    defaultPath?: string
    multiple?: boolean
    directory?: boolean
    filters?: DialogFilter[]
}

export interface SaveDialogOptions {
    title?: string
    defaultPath?: string
    filters?: DialogFilter[]
}

// 消息处理器存储
const messageHandlers = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
}>()

let isListenerRegistered = false

function registerGlobalListener(): void {
    if (isListenerRegistered) return
    isListenerRegistered = true

    window.addEventListener('message', (event) => {
        const message = event.data
        if (!message?.id) return

        const handler = messageHandlers.get(message.id)
        if (!handler) return

        clearTimeout(handler.timeout)
        messageHandlers.delete(message.id)

        if (message.error) {
            handler.reject(new Error(message.error))
        } else {
            handler.resolve(message.result)
        }
    })
}

function postMessageWithResponse<T>(command: string, params?: any): Promise<T> {
    registerGlobalListener()

    return new Promise((resolve, reject) => {
        const id = generateShortId()

        const timeout = setTimeout(() => {
            messageHandlers.delete(id)
            reject(new Error(`Dialog command "${command}" timed out`))
        }, 60000) // 对话框可能有更长的超时

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

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
    return postMessageWithResponse('show_open_dialog', {
        filters: options?.filters?.reduce((acc, f) => {
            acc[f.name] = f.extensions
            return acc
        }, {} as Record<string, string[]>),
        defaultPath: options?.defaultPath,
        multiple: options?.multiple,
        directory: options?.directory,
    })
}

export async function save(options?: SaveDialogOptions): Promise<string | null> {
    return postMessageWithResponse('show_save_dialog', {
        filters: options?.filters?.reduce((acc, f) => {
            acc[f.name] = f.extensions
            return acc
        }, {} as Record<string, string[]>),
        defaultPath: options?.defaultPath,
    })
}

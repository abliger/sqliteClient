// Mock for @tauri-apps/plugin-fs
import { generateShortId } from '../../utils/id'

export interface WriteFileOptions {
    contents: Uint8Array
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
            reject(new Error(`FS command "${command}" timed out`))
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

export async function writeFile(path: string, contents: Uint8Array): Promise<void> {
    await postMessageWithResponse('write_file', {
        path,
        content: new TextDecoder().decode(contents),
    })
}

export async function readFile(path: string): Promise<Uint8Array> {
    const content = await postMessageWithResponse<string>('read_file', { path })
    return new TextEncoder().encode(content)
}

export async function readTextFile(path: string): Promise<string> {
    return postMessageWithResponse('read_file', { path, encoding: 'utf-8' })
}

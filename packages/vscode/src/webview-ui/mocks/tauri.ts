// Mock Tauri API for VSCode webview context

interface InvokeOptions {
    [key: string]: any
}

export async function invoke<T>(cmd: string, args?: InvokeOptions): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7)

        const handler = (event: MessageEvent) => {
            const message = event.data
            if (message.id === id) {
                window.removeEventListener('message', handler)
                if (message.error) {
                    reject(new Error(message.error))
                } else {
                    resolve(message.result)
                }
            }
        }

        window.addEventListener('message', handler)
        window.vscode.postMessage({ id, command: cmd, params: args })
    })
}

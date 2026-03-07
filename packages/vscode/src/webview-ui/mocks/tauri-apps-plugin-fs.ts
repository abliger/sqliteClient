// Mock for @tauri-apps/plugin-fs

export interface WriteFileOptions {
    contents: Uint8Array
}

export async function writeFile(path: string, contents: Uint8Array): Promise<void> {
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
        window.vscode.postMessage({
            id,
            command: 'write_file',
            params: {
                path,
                content: new TextDecoder().decode(contents),
            },
        })
    })
}

export async function readFile(path: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7)

        const handler = (event: MessageEvent) => {
            const message = event.data
            if (message.id === id) {
                window.removeEventListener('message', handler)
                if (message.error) {
                    reject(new Error(message.error))
                } else {
                    const content = message.result as string
                    resolve(new TextEncoder().encode(content))
                }
            }
        }

        window.addEventListener('message', handler)
        window.vscode.postMessage({
            id,
            command: 'read_file',
            params: { path },
        })
    })
}

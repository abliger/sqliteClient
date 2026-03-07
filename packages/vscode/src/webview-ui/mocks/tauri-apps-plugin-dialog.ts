// Mock for @tauri-apps/plugin-dialog

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

export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
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
            command: 'show_open_dialog',
            params: {
                filters: options?.filters?.reduce((acc, f) => {
                    acc[f.name] = f.extensions
                    return acc
                }, {} as Record<string, string[]>),
                defaultPath: options?.defaultPath,
            },
        })
    })
}

export async function save(options?: SaveDialogOptions): Promise<string | null> {
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
            command: 'show_save_dialog',
            params: {
                filters: options?.filters?.reduce((acc, f) => {
                    acc[f.name] = f.extensions
                    return acc
                }, {} as Record<string, string[]>),
                defaultPath: options?.defaultPath,
            },
        })
    })
}

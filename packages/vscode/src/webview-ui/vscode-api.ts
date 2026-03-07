// VSCode API adapter - replaces Tauri API for webview context
declare global {
    interface Window {
        vscode: {
            postMessage(message: any): void
            getState(): any
            setState(state: any): void
        }
    }
}

// Invoke function that mimics Tauri's invoke API
export async function invoke<T>(command: string, params?: Record<string, any>): Promise<T> {
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
        window.vscode.postMessage({ id, command, params })
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

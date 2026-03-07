/**
 * 安全的 ID 生成工具
 */

let counter = 0

/**
 * 生成唯一 ID
 * 格式: timestamp-counter-random
 */
export function generateId(): string {
    const timestamp = Date.now().toString(36)
    const count = (++counter).toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${count}-${random}`
}

/**
 * 生成 UUID v4 风格的随机 ID
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * 生成短随机 ID（用于消息等）
 */
export function generateShortId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 格式化日期为相对时间（如：2分钟前、1小时前）
 */
export function formatDistanceToNow(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 10) {
        return '刚刚'
    }
    if (seconds < 60) {
        return `${seconds}秒前`
    }
    if (minutes < 60) {
        return `${minutes}分钟前`
    }
    if (hours < 24) {
        return `${hours}小时前`
    }
    if (days < 30) {
        return `${days}天前`
    }

    // 超过30天显示具体日期
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    const nowYear = now.getFullYear()
    if (year === nowYear) {
        return `${month}-${day} ${hour}:${minute}`
    }

    return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化日期为本地字符串
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

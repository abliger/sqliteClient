import { safeInvoke, isTauri } from '@utils/tauri'
import type { QueryHistoryItem } from '@types'

export const historyService = {
    async getQueryHistory(limit?: number, offset?: number): Promise<QueryHistoryItem[]> {
        if (!isTauri()) return []
        return safeInvoke('get_query_history', { limit, offset }) as Promise<QueryHistoryItem[]>
    },

    async searchHistory(query: string, limit?: number): Promise<QueryHistoryItem[]> {
        if (!isTauri()) return []
        return safeInvoke('search_history', { query, limit }) as Promise<QueryHistoryItem[]>
    },

    async deleteHistoryItem(id: string): Promise<void> {
        if (!isTauri()) return
        return safeInvoke('delete_history_item', { id }) as Promise<void>
    },

    async clearHistory(connectionId?: string): Promise<number> {
        if (!isTauri()) return 0
        return safeInvoke('clear_history', { connectionId }) as Promise<number>
    },
}

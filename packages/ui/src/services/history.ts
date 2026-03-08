import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'
import type { QueryHistoryItem } from '@types'

export const historyService = {
    async getQueryHistory(limit?: number, offset?: number): Promise<QueryHistoryItem[]> {
        if (isVSCode()) return postVSCodeMessage<QueryHistoryItem[]>('get_query_history', { limit, offset })
        if (isTauri()) return safeInvoke('get_query_history', { limit, offset }) as Promise<QueryHistoryItem[]>
        return []
    },

    async searchHistory(query: string, limit?: number): Promise<QueryHistoryItem[]> {
        if (isVSCode()) return postVSCodeMessage<QueryHistoryItem[]>('search_history', { query, limit })
        if (isTauri()) return safeInvoke('search_history', { query, limit }) as Promise<QueryHistoryItem[]>
        return []
    },

    async deleteHistoryItem(id: string): Promise<void> {
        if (isVSCode()) return postVSCodeMessage<void>('delete_history_item', { id })
        if (isTauri()) return safeInvoke('delete_history_item', { id }) as Promise<void>
    },

    async clearHistory(connectionId?: string): Promise<number> {
        if (isVSCode()) return postVSCodeMessage<number>('clear_history', { connectionId })
        if (isTauri()) return safeInvoke('clear_history', { connectionId }) as Promise<number>
        return 0
    },
}

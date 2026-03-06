import { invoke } from '@tauri-apps/api/core'
import type { QueryHistoryItem } from '@types/index'

export const historyService = {
  async getQueryHistory(limit?: number, offset?: number): Promise<QueryHistoryItem[]> {
    return invoke('get_query_history', { limit, offset })
  },

  async searchHistory(query: string, limit?: number): Promise<QueryHistoryItem[]> {
    return invoke('search_history', { query, limit })
  },

  async deleteHistoryItem(id: string): Promise<void> {
    return invoke('delete_history_item', { id })
  },

  async clearHistory(connectionId?: string): Promise<number> {
    return invoke('clear_history', { connectionId })
  }
}

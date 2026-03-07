import { invoke } from '@tauri-apps/api/core'
import type { QueryResult, QueryRow, SqlFileExecutionResult } from '@types'

export interface ExecuteQueryOptions {
    connectionId: string
    sql: string
    limit?: number
}

export interface StreamStatus {
    stream_id: string
    total_rows?: number
    fetched_rows: number
    has_more: boolean
    columns: string[]
}

export const queryService = {
    async executeQuery(options: ExecuteQueryOptions): Promise<QueryResult> {
        return invoke('execute_query', {
            connectionId: options.connectionId,
            sql: options.sql,
            limit: options.limit,
        })
    },

    async executeQueryStream(
        connectionId: string,
        sql: string,
        batchSize: number = 1000,
    ): Promise<StreamStatus> {
        return invoke('execute_query_stream', { connectionId, sql, batchSize })
    },

    async fetchStreamBatch(streamId: string, batchSize: number): Promise<QueryRow[]> {
        return invoke('fetch_stream_batch', { streamId, batchSize })
    },

    async cancelQuery(queryId: string): Promise<void> {
        return invoke('cancel_query', { queryId })
    },

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        return invoke('execute_sql_file', {
            connectionId,
            filePath,
        })
    },
}

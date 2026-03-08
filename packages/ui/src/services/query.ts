import { safeInvoke, isTauri } from '@utils/tauri'
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

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const queryService = {
    async executeQuery(options: ExecuteQueryOptions): Promise<QueryResult> {
        if (!isTauri()) throw new TauriNotAvailableError('executeQuery')
        return safeInvoke('execute_query', {
            connectionId: options.connectionId,
            sql: options.sql,
            limit: options.limit,
        }) as Promise<QueryResult>
    },

    async executeQueryStream(
        connectionId: string,
        sql: string,
        batchSize: number = 1000,
    ): Promise<StreamStatus> {
        if (!isTauri()) throw new TauriNotAvailableError('executeQueryStream')
        return safeInvoke('execute_query_stream', { connectionId, sql, batchSize }) as Promise<StreamStatus>
    },

    async fetchStreamBatch(streamId: string, batchSize: number): Promise<QueryRow[]> {
        if (!isTauri()) throw new TauriNotAvailableError('fetchStreamBatch')
        return safeInvoke('fetch_stream_batch', { streamId, batchSize }) as Promise<QueryRow[]>
    },

    async cancelQuery(queryId: string): Promise<void> {
        if (!isTauri()) throw new TauriNotAvailableError('cancelQuery')
        return safeInvoke('cancel_query', { queryId }) as Promise<void>
    },

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        if (!isTauri()) throw new TauriNotAvailableError('executeSqlFile')
        return safeInvoke('execute_sql_file', {
            connectionId,
            filePath,
        }) as Promise<SqlFileExecutionResult>
    },
}

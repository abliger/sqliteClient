import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'
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

async function executeQueryTauri(options: ExecuteQueryOptions): Promise<QueryResult> {
    return safeInvoke('execute_query', {
        connectionId: options.connectionId,
        sql: options.sql,
        limit: options.limit,
    }) as Promise<QueryResult>
}

async function executeQueryVSCode(options: ExecuteQueryOptions): Promise<QueryResult> {
    return postVSCodeMessage<QueryResult>('execute_query', {
        connectionId: options.connectionId,
        sql: options.sql,
        limit: options.limit,
    })
}

async function executeQueryStreamTauri(
    connectionId: string,
    sql: string,
    batchSize: number = 1000,
): Promise<StreamStatus> {
    return safeInvoke('execute_query_stream', { connectionId, sql, batchSize }) as Promise<StreamStatus>
}

async function executeQueryStreamVSCode(
    connectionId: string,
    sql: string,
    batchSize: number = 1000,
): Promise<StreamStatus> {
    return postVSCodeMessage<StreamStatus>('execute_query_stream', { connectionId, sql, batchSize })
}

async function fetchStreamBatchTauri(streamId: string, batchSize: number): Promise<QueryRow[]> {
    return safeInvoke('fetch_stream_batch', { streamId, batchSize }) as Promise<QueryRow[]>
}

async function fetchStreamBatchVSCode(streamId: string, batchSize: number): Promise<QueryRow[]> {
    return postVSCodeMessage<QueryRow[]>('fetch_stream_batch', { streamId, batchSize })
}

async function cancelQueryTauri(queryId: string): Promise<void> {
    return safeInvoke('cancel_query', { queryId }) as Promise<void>
}

async function cancelQueryVSCode(queryId: string): Promise<void> {
    return postVSCodeMessage<void>('cancel_query', { queryId })
}

async function executeSqlFileTauri(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
    return safeInvoke('execute_sql_file', { connectionId, filePath }) as Promise<SqlFileExecutionResult>
}

async function executeSqlFileVSCode(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
    return postVSCodeMessage<SqlFileExecutionResult>('execute_sql_file', { connectionId, filePath })
}

export const queryService = {
    async executeQuery(options: ExecuteQueryOptions): Promise<QueryResult> {
        if (isVSCode()) return executeQueryVSCode(options)
        if (isTauri()) return executeQueryTauri(options)
        throw new TauriNotAvailableError('executeQuery')
    },

    async executeQueryStream(
        connectionId: string,
        sql: string,
        batchSize: number = 1000,
    ): Promise<StreamStatus> {
        if (isVSCode()) return executeQueryStreamVSCode(connectionId, sql, batchSize)
        if (isTauri()) return executeQueryStreamTauri(connectionId, sql, batchSize)
        throw new TauriNotAvailableError('executeQueryStream')
    },

    async fetchStreamBatch(streamId: string, batchSize: number): Promise<QueryRow[]> {
        if (isVSCode()) return fetchStreamBatchVSCode(streamId, batchSize)
        if (isTauri()) return fetchStreamBatchTauri(streamId, batchSize)
        throw new TauriNotAvailableError('fetchStreamBatch')
    },

    async cancelQuery(queryId: string): Promise<void> {
        if (isVSCode()) return cancelQueryVSCode(queryId)
        if (isTauri()) return cancelQueryTauri(queryId)
        throw new TauriNotAvailableError('cancelQuery')
    },

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        if (isVSCode()) return executeSqlFileVSCode(connectionId, filePath)
        if (isTauri()) return executeSqlFileTauri(connectionId, filePath)
        throw new TauriNotAvailableError('executeSqlFile')
    },
}

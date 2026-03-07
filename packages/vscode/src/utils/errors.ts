/**
 * 自定义错误类
 */

export class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly originalError?: Error
    ) {
        super(message)
        this.name = 'DatabaseError'
        Object.setPrototypeOf(this, DatabaseError.prototype)
    }
}

export class ConnectionError extends DatabaseError {
    constructor(message: string, originalError?: Error) {
        super(message, 'CONNECTION_ERROR', originalError)
        this.name = 'ConnectionError'
        Object.setPrototypeOf(this, ConnectionError.prototype)
    }
}

export class QueryError extends DatabaseError {
    constructor(message: string, originalError?: Error) {
        super(message, 'QUERY_ERROR', originalError)
        this.name = 'QueryError'
        Object.setPrototypeOf(this, QueryError.prototype)
    }
}

export class ValidationError extends DatabaseError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR')
        this.name = 'ValidationError'
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

export class NotFoundError extends DatabaseError {
    constructor(message: string) {
        super(message, 'NOT_FOUND')
        this.name = 'NotFoundError'
        Object.setPrototypeOf(this, NotFoundError.prototype)
    }
}

/**
 * 将错误转换为友好的消息
 */
export function formatError(error: unknown): string {
    if (error instanceof DatabaseError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}

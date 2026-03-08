import { describe, it, expect, vi, beforeEach } from 'vitest'
import { connectionService } from './connection'

// Mock the tauri utils
vi.mock('@utils/tauri', () => ({
    isTauri: vi.fn(),
    isVSCode: vi.fn(),
}))

// Mock the underlying services
vi.mock('./connection-tauri', () => ({
    connectionService: {
        createConnection: vi.fn(),
        createNewDatabase: vi.fn(),
        closeConnection: vi.fn(),
        listConnections: vi.fn(),
        getConnectionInfo: vi.fn(),
        testConnection: vi.fn(),
        refreshMetadata: vi.fn(),
        restoreSavedConnections: vi.fn(),
        loadSavedConnectionConfigs: vi.fn(),
    },
}))

vi.mock('./connection-vscode', () => ({
    connectionVSCodeService: {
        createConnection: vi.fn(),
        createNewDatabase: vi.fn(),
        closeConnection: vi.fn(),
        listConnections: vi.fn(),
        getConnectionInfo: vi.fn(),
        testConnection: vi.fn(),
        refreshMetadata: vi.fn(),
        restoreSavedConnections: vi.fn(),
        loadSavedConnectionConfigs: vi.fn(),
    },
}))

describe('Connection Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should create connection', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            const mockConnection = { id: '1', name: 'test', config: { db_path: '/path/to/db' } }
            vi.mocked(tauriService.createConnection).mockResolvedValue(mockConnection as any)

            const result = await connectionService.createConnection('test', '/path/to/db.sqlite')

            expect(tauriService.createConnection).toHaveBeenCalledWith('test', '/path/to/db.sqlite')
            expect(result).toEqual(mockConnection)
        })

        it('should create new database', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            const mockConnection = { id: '1', name: 'new_db', config: { db_path: '/path/to/new' } }
            vi.mocked(tauriService.createNewDatabase).mockResolvedValue(mockConnection as any)

            const result = await connectionService.createNewDatabase('new_db', '/path/to/new_db.sqlite')

            expect(tauriService.createNewDatabase).toHaveBeenCalledWith('new_db', '/path/to/new_db.sqlite')
            expect(result).toEqual(mockConnection)
        })

        it('should close connection', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            vi.mocked(tauriService.closeConnection).mockResolvedValue(undefined)

            await connectionService.closeConnection('conn-123')

            expect(tauriService.closeConnection).toHaveBeenCalledWith('conn-123')
        })

        it('should list connections', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            const mockConnections = [{ id: '1' }, { id: '2' }]
            vi.mocked(tauriService.listConnections).mockResolvedValue(mockConnections as any)

            const result = await connectionService.listConnections()

            expect(tauriService.listConnections).toHaveBeenCalled()
            expect(result).toEqual(mockConnections)
        })

        it('should get connection info', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            const mockConnection = { id: '1', name: 'test' }
            vi.mocked(tauriService.getConnectionInfo).mockResolvedValue(mockConnection as any)

            const result = await connectionService.getConnectionInfo('conn-123')

            expect(tauriService.getConnectionInfo).toHaveBeenCalledWith('conn-123')
            expect(result).toEqual(mockConnection)
        })

        it('should test connection', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            vi.mocked(tauriService.testConnection).mockResolvedValue(undefined)

            await connectionService.testConnection('/path/to/db.sqlite')

            expect(tauriService.testConnection).toHaveBeenCalledWith('/path/to/db.sqlite')
        })

        it('should refresh metadata', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            const mockMetadata = { size_bytes: 1024, table_count: 5 }
            vi.mocked(tauriService.refreshMetadata).mockResolvedValue(mockMetadata as any)

            const result = await connectionService.refreshMetadata('conn-123')

            expect(tauriService.refreshMetadata).toHaveBeenCalledWith('conn-123')
            expect(result).toEqual(mockMetadata)
        })

        it('should handle errors', async () => {
            const { connectionService: tauriService } = await import('./connection-tauri')
            vi.mocked(tauriService.createConnection).mockRejectedValue(new Error('Connection failed'))

            await expect(
                connectionService.createConnection('test', '/path/to/db.sqlite'),
            ).rejects.toThrow('Connection failed')
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code service for createConnection', async () => {
            const { connectionVSCodeService } = await import('./connection-vscode')
            const mockConnection = { id: '1', name: 'test' }
            vi.mocked(connectionVSCodeService.createConnection).mockResolvedValue(mockConnection as any)

            const result = await connectionService.createConnection('test', '/path/to/db.sqlite')

            expect(connectionVSCodeService.createConnection).toHaveBeenCalledWith('test', '/path/to/db.sqlite')
            expect(result).toEqual(mockConnection)
        })

        it('should use VS Code service for listConnections', async () => {
            const { connectionVSCodeService } = await import('./connection-vscode')
            const mockConnections = [{ id: '1' }]
            vi.mocked(connectionVSCodeService.listConnections).mockResolvedValue(mockConnections as any)

            const result = await connectionService.listConnections()

            expect(connectionVSCodeService.listConnections).toHaveBeenCalled()
            expect(result).toEqual(mockConnections)
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should throw error when no service available', async () => {
            await expect(
                connectionService.createConnection('test', '/path/to/db.sqlite'),
            ).rejects.toThrow('No connection service available')
        })

        it('should throw error for all operations', async () => {
            await expect(connectionService.createNewDatabase('test', '/path')).rejects.toThrow('No connection service available')
            await expect(connectionService.closeConnection('id')).rejects.toThrow('No connection service available')
            await expect(connectionService.getConnectionInfo('id')).rejects.toThrow('No connection service available')
            await expect(connectionService.testConnection('/path')).rejects.toThrow('No connection service available')
            await expect(connectionService.refreshMetadata('id')).rejects.toThrow('No connection service available')
        })
    })
})

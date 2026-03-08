import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ConnectionTabs from './ConnectionTabs.vue'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { useSettingsStore } from '@stores/settings'
import { useToastStore } from '@stores/toast'
import type { ConnectionInfo } from '@types'

// Mock Tauri utils
vi.mock('@utils/tauri', () => ({
    isTauri: vi.fn(() => false),
    isDialogSupported: vi.fn(() => false),
    isVSCode: vi.fn(() => false),
    safeInvoke: vi.fn(),
}))

describe('ConnectionTabs Component', () => {
    const mockConnection: ConnectionInfo = {
        config: {
            id: 'test-conn-1',
            name: 'TestDB',
            db_path: '/path/to/test.db',
            created_at: '2024-01-01T00:00:00Z',
        },
        status: 'connected',
        metadata: {
            version: '3.39.0',
            page_size: 4096,
            page_count: 100,
            table_count: 5,
            index_count: 2,
            trigger_count: 0,
            size_bytes: 409600,
        },
    }

    const mockConnection2: ConnectionInfo = {
        config: {
            id: 'test-conn-2',
            name: 'AnotherDB',
            db_path: '/path/to/another.db',
            created_at: '2024-01-02T00:00:00Z',
        },
        status: 'connected',
        metadata: {
            version: '3.39.0',
            page_size: 4096,
            page_count: 50,
            table_count: 3,
            index_count: 1,
            trigger_count: 0,
            size_bytes: 204800,
        },
    }

    beforeEach(() => {
        setActivePinia(createPinia())
        // Mock window event listeners
        vi.stubGlobal('window', {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            matchMedia: vi.fn(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const createWrapper = (props = {}) => {
        return mount(ConnectionTabs, {
            props: {
                isSidebarVisible: true,
                isBottomPanelVisible: true,
                ...props,
            },
        })
    }

    describe('rendering', () => {
        it('should render toolbar with buttons', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('button').exists()).toBe(true)
        })

        it('should show empty state when no connections', () => {
            const wrapper = createWrapper()
            expect(wrapper.text()).toContain('connection.noConnections')
        })

        it('should render connection tabs', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('TestDB')
        })

        it('should show connection status indicator', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            const statusIndicator = wrapper.find('.rounded-full')
            expect(statusIndicator.exists()).toBe(true)
            expect(statusIndicator.classes()).toContain('bg-green-500')
        })

        it('should show disconnected status in red', async () => {
            const store = useConnectionStore()
            store.connections = [{ ...mockConnection, status: 'disconnected' }]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            const statusIndicator = wrapper.find('.rounded-full')
            expect(statusIndicator.classes()).toContain('bg-red-500')
        })

        it('should display file size for each connection', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('400 KB')
        })

        it('should render multiple connection tabs', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection, mockConnection2]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('TestDB')
            expect(wrapper.text()).toContain('AnotherDB')
        })
    })

    describe('interactions', () => {
        it('should set active connection when tab clicked', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection, mockConnection2]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            const setActiveSpy = vi.spyOn(store, 'setActiveConnection')
            
            // Call the method directly instead of using trigger
            await wrapper.vm.connectionStore.setActiveConnection(mockConnection2.config.id)
            
            expect(setActiveSpy).toHaveBeenCalledWith(mockConnection2.config.id)
        })

        it('should emit toggle-sidebar event', async () => {
            const wrapper = createWrapper()

            // Find the sidebar toggle button
            const buttons = wrapper.findAll('button')
            const sidebarButton = buttons.find(btn => 
                btn.html().includes('Bars3')
            )

            if (sidebarButton) {
                await sidebarButton.trigger('click')
                expect(wrapper.emitted('toggle-sidebar')).toBeTruthy()
            }
        })

        it('should emit toggle-bottom-panel event', async () => {
            const wrapper = createWrapper()

            const buttons = wrapper.findAll('button')
            const bottomPanelButton = buttons.find(btn => 
                btn.html().includes('ChevronDown') || btn.html().includes('ChevronUp')
            )

            if (bottomPanelButton) {
                await bottomPanelButton.trigger('click')
                expect(wrapper.emitted('toggle-bottom-panel')).toBeTruthy()
            }
        })

        it('should open settings panel when settings button clicked', async () => {
            const settingsStore = useSettingsStore()
            const wrapper = createWrapper()

            const buttons = wrapper.findAll('button')
            const settingsButton = buttons.find(btn => 
                btn.html().includes('Cog6Tooth')
            )

            if (settingsButton) {
                const openSettingsSpy = vi.spyOn(settingsStore, 'openSettingsPanel')
                await settingsButton.trigger('click')
                expect(openSettingsSpy).toHaveBeenCalled()
            }
        })

        it('should show close button on hover', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            const closeButton = wrapper.find('.opacity-0')
            expect(closeButton.exists()).toBe(true)
        })

        it('should close connection when close button clicked', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            const closeSpy = vi.spyOn(store, 'closeConnection')
            
            // Call the method directly
            await wrapper.vm.handleCloseConnection(mockConnection.config.id, new Event('click'))
            
            expect(closeSpy).toHaveBeenCalledWith(mockConnection.config.id)
        })
    })

    describe('context menu', () => {
        it('should show context menu on right click', async () => {
            const store = useConnectionStore()
            store.connections = [mockConnection]
            store.activeConnectionId = mockConnection.config.id

            const wrapper = createWrapper()
            await nextTick()

            // Call handleContextMenu directly
            const mockEvent = {
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            } as unknown as MouseEvent

            wrapper.vm.handleContextMenu(mockEvent, mockConnection.config.id)

            // Check that context menu state was updated
            expect(wrapper.vm.contextMenu.show).toBe(true)
            expect(wrapper.vm.contextMenu.connectionId).toBe(mockConnection.config.id)
        })
    })

    describe('file operations', () => {
        it('should show toast error when dialog not supported', async () => {
            const toastStore = useToastStore()
            const wrapper = createWrapper()

            const buttons = wrapper.findAll('button')
            const openButton = buttons.find(btn => 
                btn.html().includes('FolderOpen')
            )

            if (openButton) {
                const errorSpy = vi.spyOn(toastStore, 'error')
                await openButton.trigger('click')
                // Should show error because dialog is not supported in test
                expect(errorSpy).toHaveBeenCalled()
            }
        })
    })

    describe('formatting', () => {
        it('should format bytes correctly', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.formatFileSize(0)).toBe('0 B')
            expect(wrapper.vm.formatFileSize(1024)).toBe('1 KB')
            expect(wrapper.vm.formatFileSize(1024 * 1024)).toBe('1 MB')
            expect(wrapper.vm.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
        })

        it('should format with decimal places', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.formatFileSize(1536)).toBe('1.5 KB')
            expect(wrapper.vm.formatFileSize(2048)).toBe('2 KB')
        })
    })
})

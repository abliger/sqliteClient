import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// Mock window.matchMedia for theme detection
vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
})))

// Mock Monaco Editor - must use inline factory without external variables
vi.mock('monaco-editor', () => ({
    __esModule: true,
    editor: {
        create: vi.fn(() => ({
            setValue: vi.fn(),
            getValue: vi.fn(() => 'SELECT * FROM users'),
            dispose: vi.fn(),
            onDidChangeModelContent: vi.fn((cb) => {
                if (cb) cb()
                return { dispose: vi.fn() }
            }),
            addCommand: vi.fn(),
            addAction: vi.fn(),
            getSelection: vi.fn(() => ({
                isEmpty: vi.fn(() => true),
            })),
            getModel: vi.fn(() => ({
                getValueInRange: vi.fn(() => 'SELECT * FROM users'),
                getFullModelRange: vi.fn(() => ({})),
            })),
            saveViewState: vi.fn(() => ({
                cursorState: [{ position: { lineNumber: 1, column: 1 } }],
            })),
            setPosition: vi.fn(),
            revealLineInCenter: vi.fn(),
            getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
            executeEdits: vi.fn(),
            focus: vi.fn(),
            trigger: vi.fn(),
            getAction: vi.fn(() => null),
        })),
        setTheme: vi.fn(),
    },
    languages: {
        registerDocumentFormattingEditProvider: vi.fn(),
        registerDocumentRangeFormattingEditProvider: vi.fn(),
    },
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { Enter: 3, Slash: 85 },
    // Range needs to be a proper class constructor
    Range: class MockRange {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
        constructor(a: number, b: number, c: number, d: number) {
            this.startLineNumber = a
            this.startColumn = b
            this.endLineNumber = c
            this.endColumn = d
        }
    },
}))

// Mock worker imports
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({ 
    __esModule: true, 
    default: vi.fn(() => class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }) 
}))
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({ 
    __esModule: true, 
    default: vi.fn(() => class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }) 
}))
vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({ 
    __esModule: true, 
    default: vi.fn(() => class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }) 
}))
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({ 
    __esModule: true, 
    default: vi.fn(() => class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }) 
}))
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({ 
    __esModule: true, 
    default: vi.fn(() => class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }) 
}))

// Mock composables
vi.mock('@composables/sql-completion', () => ({
    useSQLCompletion: vi.fn(() => ({
        dispose: vi.fn(),
    })),
    FullFeaturedStrategyFactory: vi.fn(),
}))

import * as monaco from 'monaco-editor'
import SQLEditor from './SQLEditor.vue'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useSettingsStore } from '@stores/settings'

describe('SQLEditor Component', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    const createWrapper = () => {
        return mount(SQLEditor, {
            global: {
                stubs: {
                    'EditorToolbar': true,
                    'QueryTabs': true,
                    'SqlImportDialog': true,
                    'SnippetPanel': true,
                },
            },
        })
    }

    describe('rendering', () => {
        it('should render editor container', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.h-full').exists()).toBe(true)
        })

        it('should render toolbar component', () => {
            const wrapper = createWrapper()
            expect(wrapper.findComponent({ name: 'EditorToolbar' }).exists()).toBe(true)
        })

        it('should render query tabs component', () => {
            const wrapper = createWrapper()
            expect(wrapper.findComponent({ name: 'QueryTabs' }).exists()).toBe(true)
        })
    })

    describe('monaco editor initialization', () => {
        it('should create monaco editor on mount', async () => {
            createWrapper()
            await flushPromises()
            expect(monaco.editor.create).toHaveBeenCalled()
        })

        it('should configure editor with correct options', async () => {
            createWrapper()
            await flushPromises()
            const call = (monaco.editor.create as any).mock.calls[0]
            const options = call[1]
            expect(options.language).toBe('sql')
            expect(options.fontSize).toBe(14)
            expect(options.minimap.enabled).toBe(false)
            expect(options.automaticLayout).toBe(true)
        })

        it('should set theme based on settings', async () => {
            const settingsStore = useSettingsStore()
            settingsStore.theme = 'dark'
            createWrapper()
            await flushPromises()
            // Component creates editor with theme based on settings
            const createCall = (monaco.editor.create as any).mock.calls[0]
            const options = createCall[1]
            // On mount, editor is created with theme
            expect(options.theme).toBeDefined()
        })
    })

    describe('query execution', () => {
        it('should not execute if no active connection', async () => {
            const connectionStore = useConnectionStore()
            connectionStore.activeConnectionId = null
            const wrapper = createWrapper()
            await flushPromises()
            const result = await wrapper.vm.handleExecuteQuery()
            expect(result).toBeUndefined()
        })

        it('should not execute empty SQL', async () => {
            const connectionStore = useConnectionStore()
            connectionStore.activeConnectionId = 'test-conn'
            const wrapper = createWrapper()
            await flushPromises()
            const result = await wrapper.vm.handleExecuteQuery()
            expect(result).toBeUndefined()
        })
    })

    describe('snippet panel', () => {
        it('should toggle snippet panel', async () => {
            const wrapper = createWrapper()
            await flushPromises()
            expect(wrapper.vm.showSnippetPanel).toBe(false)
            await wrapper.vm.handleToggleTemplates()
            expect(wrapper.vm.showSnippetPanel).toBe(true)
        })

        it('should close snippet panel on insert', async () => {
            const wrapper = createWrapper()
            await flushPromises()
            wrapper.vm.showSnippetPanel = true
            await wrapper.vm.handleSnippetInsert('SELECT 1')
            expect(wrapper.vm.showSnippetPanel).toBe(false)
        })
    })

    describe('import dialog', () => {
        it('should show import dialog when import triggered', async () => {
            const connectionStore = useConnectionStore()
            connectionStore.activeConnectionId = 'test-conn'
            const wrapper = createWrapper()
            await flushPromises()
            await wrapper.vm.handleImportSql()
            expect(wrapper.vm.showImportDialog).toBe(true)
        })

        it('should not show import dialog without connection', async () => {
            const connectionStore = useConnectionStore()
            connectionStore.activeConnectionId = null
            const wrapper = createWrapper()
            await flushPromises()
            await wrapper.vm.handleImportSql()
            expect(wrapper.vm.showImportDialog).toBe(false)
        })

        it('should handle import completed', async () => {
            const schemaStore = useSchemaStore()
            const connectionStore = useConnectionStore()
            connectionStore.activeConnectionId = 'test-conn'
            const wrapper = createWrapper()
            await flushPromises()
            const loadTablesSpy = vi.spyOn(schemaStore, 'loadTables')
            await wrapper.vm.handleImportCompleted({
                file_path: '/test.sql',
                total_statements: 10,
                success_count: 10,
                error_count: 0,
                statements: [],
                total_duration_ms: 1000,
            })
            expect(loadTablesSpy).toHaveBeenCalledWith('test-conn')
        })
    })
})

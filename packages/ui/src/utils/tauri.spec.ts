import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isTauri, isVSCode, isDialogSupported, safeInvoke, createTauriOnlyFn } from './tauri'

describe('tauri utils', () => {
    // 保存原始的 window 对象
    const originalWindow = globalThis.window

    beforeEach(() => {
        // 清除所有 mock
        vi.clearAllMocks()
        vi.unstubAllGlobals()
    })

    afterEach(() => {
        // 恢复原始 window
        vi.stubGlobal('window', originalWindow)
    })

    describe('isTauri()', () => {
        it('should return false when window is undefined (SSR environment)', () => {
            // @ts-expect-error - 模拟 SSR 环境
            vi.stubGlobal('window', undefined)
            expect(isTauri()).toBe(false)
        })

        it('should return false when window exists but __TAURI_INTERNALS__ is undefined', () => {
            vi.stubGlobal('window', {})
            expect(isTauri()).toBe(false)
        })

        it('should return true when __TAURI_INTERNALS__ exists', () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })
            expect(isTauri()).toBe(true)
        })

        it('should return true when __TAURI_INTERNALS__ is an empty object', () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {}
            })
            expect(isTauri()).toBe(true)
        })
    })

    describe('isVSCode()', () => {
        it('should return false when window is undefined', () => {
            // @ts-expect-error - 模拟 SSR 环境
            vi.stubGlobal('window', undefined)
            expect(isVSCode()).toBe(false)
        })

        it('should return false when window exists but vscode is undefined', () => {
            vi.stubGlobal('window', {})
            expect(isVSCode()).toBe(false)
        })

        it('should return true when vscode object exists', () => {
            vi.stubGlobal('window', {
                vscode: {
                    postMessage: vi.fn()
                }
            })
            expect(isVSCode()).toBe(true)
        })

        it('should return true when vscode is an empty object', () => {
            vi.stubGlobal('window', {
                vscode: {}
            })
            expect(isVSCode()).toBe(true)
        })
    })

    describe('isDialogSupported()', () => {
        it('should return false when window is undefined', () => {
            // @ts-expect-error - 模拟 SSR 环境
            vi.stubGlobal('window', undefined)
            expect(isDialogSupported()).toBe(false)
        })

        it('should return false when neither Tauri nor VSCode environment', () => {
            vi.stubGlobal('window', {})
            expect(isDialogSupported()).toBe(false)
        })

        it('should return true in Tauri environment', () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })
            expect(isDialogSupported()).toBe(true)
        })

        it('should return true in VSCode environment', () => {
            vi.stubGlobal('window', {
                vscode: {
                    postMessage: vi.fn()
                }
            })
            expect(isDialogSupported()).toBe(true)
        })

        it('should return true when both environments are present', () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                },
                vscode: {
                    postMessage: vi.fn()
                }
            })
            expect(isDialogSupported()).toBe(true)
        })
    })

    describe('safeInvoke()', () => {
        it('should return default value when not in Tauri environment', async () => {
            vi.stubGlobal('window', {})
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const result = await safeInvoke('test_command', { key: 'value' }, 'default')

            expect(result).toBe('default')
            expect(consoleSpy).toHaveBeenCalledWith('[Tauri] Not in Tauri environment, skipping invoke: test_command')
            consoleSpy.mockRestore()
        })

        it('should return undefined when no default value provided and not in Tauri', async () => {
            vi.stubGlobal('window', {})
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const result = await safeInvoke('test_command', { key: 'value' })

            expect(result).toBeUndefined()
            consoleSpy.mockRestore()
        })

        it('should call invoke when in Tauri environment', async () => {
            const mockInvoke = vi.fn().mockResolvedValue('success')
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: mockInvoke
                }
            })

            // Mock the dynamic import
            vi.doMock('@tauri-apps/api/core', () => ({
                invoke: mockInvoke
            }))

            // 重新导入模块以使用 mock
            const { safeInvoke: mockedSafeInvoke } = await import('./tauri')
            const result = await mockedSafeInvoke('test_command', { key: 'value' })

            expect(mockInvoke).toHaveBeenCalledWith('test_command', { key: 'value' })
            expect(result).toBe('success')

            vi.doUnmock('@tauri-apps/api/core')
        })

        it('should work without args parameter', async () => {
            vi.stubGlobal('window', {})
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const result = await safeInvoke('test_command')

            expect(result).toBeUndefined()
            expect(consoleSpy).toHaveBeenCalledWith('[Tauri] Not in Tauri environment, skipping invoke: test_command')
            consoleSpy.mockRestore()
        })
    })

    describe('createTauriOnlyFn()', () => {
        it('should return wrapped function', () => {
            const originalFn = vi.fn().mockResolvedValue('result')
            const wrappedFn = createTauriOnlyFn(originalFn)

            expect(typeof wrappedFn).toBe('function')
        })

        it('should call original function in Tauri environment', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const originalFn = vi.fn().mockResolvedValue('result')
            const wrappedFn = createTauriOnlyFn(originalFn)

            const result = await wrappedFn('arg1', 'arg2')

            expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2')
            expect(originalFn).toHaveBeenCalledTimes(1)
            expect(result).toBe('result')
        })

        it('should return undefined and log warning when not in Tauri with fallback message', async () => {
            vi.stubGlobal('window', {})
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const originalFn = vi.fn().mockResolvedValue('result')

            const wrappedFn = createTauriOnlyFn(originalFn, 'This feature requires Tauri')
            const result = await wrappedFn('arg1')

            expect(result).toBeUndefined()
            expect(originalFn).not.toHaveBeenCalled()
            expect(consoleSpy).toHaveBeenCalledWith('[Tauri] This feature requires Tauri')
            consoleSpy.mockRestore()
        })

        it('should return undefined without logging when not in Tauri and no fallback message', async () => {
            vi.stubGlobal('window', {})
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const originalFn = vi.fn().mockResolvedValue('result')

            const wrappedFn = createTauriOnlyFn(originalFn)
            const result = await wrappedFn('arg1')

            expect(result).toBeUndefined()
            expect(originalFn).not.toHaveBeenCalled()
            expect(consoleSpy).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })

        it('should pass multiple arguments correctly', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const originalFn = vi.fn().mockResolvedValue('result')
            const wrappedFn = createTauriOnlyFn(originalFn)

            await wrappedFn(1, 'string', { obj: true }, [1, 2, 3])

            expect(originalFn).toHaveBeenCalledWith(1, 'string', { obj: true }, [1, 2, 3])
        })

        it('should handle async function rejection', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const error = new Error('Test error')
            const originalFn = vi.fn().mockRejectedValue(error)
            const wrappedFn = createTauriOnlyFn(originalFn)

            await expect(wrappedFn()).rejects.toThrow('Test error')
        })

        it('should handle function returning undefined', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const originalFn = vi.fn().mockResolvedValue(undefined)
            const wrappedFn = createTauriOnlyFn(originalFn)

            const result = await wrappedFn()

            expect(result).toBeUndefined()
        })

        it('should handle function returning null', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const originalFn = vi.fn().mockResolvedValue(null)
            const wrappedFn = createTauriOnlyFn(originalFn)

            const result = await wrappedFn()

            expect(result).toBeNull()
        })

        it('should handle function returning complex object', async () => {
            vi.stubGlobal('window', {
                __TAURI_INTERNALS__: {
                    invoke: vi.fn()
                }
            })

            const complexResult = {
                id: 1,
                name: 'test',
                nested: { value: true },
                array: [1, 2, 3]
            }
            const originalFn = vi.fn().mockResolvedValue(complexResult)
            const wrappedFn = createTauriOnlyFn(originalFn)

            const result = await wrappedFn()

            expect(result).toEqual(complexResult)
        })
    })
})

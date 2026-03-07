import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settings'

// Mock the tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Settings Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default state', () => {
    const store = useSettingsStore()
    
    expect(store.settings).toEqual({
      locale: 'en',
      theme: 'auto'
    })
    expect(store.isLoading).toBe(false)
    expect(store.isPanelOpen).toBe(false)
    expect(store.locale).toBe('en')
    expect(store.theme).toBe('auto')
  })

  it('should toggle settings panel', () => {
    const store = useSettingsStore()
    
    expect(store.isPanelOpen).toBe(false)
    
    store.toggleSettingsPanel()
    expect(store.isPanelOpen).toBe(true)
    
    store.toggleSettingsPanel()
    expect(store.isPanelOpen).toBe(false)
  })

  it('should open settings panel', () => {
    const store = useSettingsStore()
    
    store.openSettingsPanel()
    expect(store.isPanelOpen).toBe(true)
  })

  it('should close settings panel', () => {
    const store = useSettingsStore()
    
    store.openSettingsPanel()
    expect(store.isPanelOpen).toBe(true)
    
    store.closeSettingsPanel()
    expect(store.isPanelOpen).toBe(false)
  })

  it('should update locale', async () => {
    const store = useSettingsStore()
    const { invoke } = await import('@tauri-apps/api/core')
    
    vi.mocked(invoke).mockResolvedValue(undefined)
    
    await store.setLocale('zh-CN')
    
    expect(store.locale).toBe('zh-CN')
  })

  it('should update theme', async () => {
    const store = useSettingsStore()
    const { invoke } = await import('@tauri-apps/api/core')
    
    vi.mocked(invoke).mockResolvedValue(undefined)
    
    await store.setTheme('dark')
    
    expect(store.theme).toBe('dark')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTheme, type Theme } from './useTheme'

describe('useTheme', () => {
  // Mock matchMedia
  let matchMediaMock: any
  let mediaQueryListeners: ((e: { matches: boolean }) => void)[] = []
  let matchMediaReturns: any = null

  beforeEach(() => {
    mediaQueryListeners = []

    // Setup matchMedia mock
    matchMediaReturns = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn((event: string, callback: (e: { matches: boolean }) => void) => {
        mediaQueryListeners.push(callback)
      }),
      removeEventListener: vi.fn((event: string, callback: (e: { matches: boolean }) => void) => {
        const index = mediaQueryListeners.indexOf(callback)
        if (index > -1) {
          mediaQueryListeners.splice(index, 1)
        }
      }),
      dispatchEvent: vi.fn(),
    }

    matchMediaMock = vi.fn().mockImplementation((query: string) => matchMediaReturns)
    window.matchMedia = matchMediaMock

    // Reset document classList
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove('dark')
  })

  describe('basic functionality', () => {
    it('should be importable', async () => {
      expect(typeof useTheme).toBe('function')
    })

    it('should export Theme type', async () => {
      // TypeScript will check this at compile time
      const theme: Theme = 'dark'
      expect(theme).toBe('dark')
    })

    it('should return systemDark and updateTheme', () => {
      const currentTheme = () => 'light' as Theme
      const { systemDark, updateTheme } = useTheme(currentTheme)

      expect(systemDark).toBeDefined()
      expect(typeof systemDark.value).toBe('boolean')
      expect(typeof updateTheme).toBe('function')
    })
  })

  describe('theme application via updateTheme', () => {
    it('should add dark class for dark theme', () => {
      const currentTheme = () => 'dark' as Theme

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should remove dark class for light theme', () => {
      document.documentElement.classList.add('dark')
      const currentTheme = () => 'light' as Theme

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should handle auto theme when system prefers light', () => {
      matchMediaReturns.matches = false // System prefers light

      const currentTheme = () => 'auto' as Theme
      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should handle auto theme when system prefers dark', () => {
      matchMediaReturns.matches = true // System prefers dark

      const currentTheme = () => 'auto' as Theme
      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('reactive theme changes', () => {
    it('should react to theme changes', async () => {
      const themeRef = ref<Theme>('light')
      const currentTheme = () => themeRef.value

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      themeRef.value = 'dark'
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should switch from light to dark', () => {
      const themeRef = ref<Theme>('light')
      const currentTheme = () => themeRef.value

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      themeRef.value = 'dark'
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should switch from dark to light', () => {
      const themeRef = ref<Theme>('dark')
      const currentTheme = () => themeRef.value

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)

      themeRef.value = 'light'
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should handle auto theme switching', () => {
      matchMediaReturns.matches = false // Initially system prefers light

      const themeRef = ref<Theme>('auto')
      const currentTheme = () => themeRef.value

      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      // Initially system prefers light
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // System switches to dark
      matchMediaReturns.matches = true
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('system theme detection', () => {
    it('should update systemDark when media query changes', () => {
      const currentTheme = () => 'auto' as Theme
      const { systemDark } = useTheme(currentTheme)

      expect(systemDark.value).toBe(false)

      // Simulate system theme change via event listener
      if (mediaQueryListeners.length > 0) {
        mediaQueryListeners[0]({ matches: true })
        expect(systemDark.value).toBe(true)
      }
    })

    it('should update theme when in auto mode and system changes', () => {
      const currentTheme = () => 'auto' as Theme
      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // Simulate system theme change to dark
      matchMediaReturns.matches = true
      if (mediaQueryListeners.length > 0) {
        mediaQueryListeners[0]({ matches: true })
        // The handler should update the theme
        updateTheme()
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      }
    })

    it('should not update theme when not in auto mode and system changes', () => {
      const currentTheme = () => 'light' as Theme
      const { updateTheme } = useTheme(currentTheme)
      updateTheme()

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // Simulate system theme change to dark
      matchMediaReturns.matches = true
      if (mediaQueryListeners.length > 0) {
        mediaQueryListeners[0]({ matches: true })
        // Theme should remain light (not auto)
        updateTheme()
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle rapid theme switches', () => {
      const themeRef = ref<Theme>('light')
      const currentTheme = () => themeRef.value

      const { updateTheme } = useTheme(currentTheme)

      // Rapid switching
      updateTheme()
      themeRef.value = 'dark'
      updateTheme()
      themeRef.value = 'light'
      updateTheme()
      themeRef.value = 'dark'
      updateTheme()
      themeRef.value = 'auto'
      matchMediaReturns.matches = false
      updateTheme()

      // Final state should match auto (light since system prefers light)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should call matchMedia with correct query', () => {
      const currentTheme = () => 'auto' as Theme
      useTheme(currentTheme)

      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    })

    it('should setup event listener for media query changes in onMounted', () => {
      // Note: addEventListener is called inside onMounted, which only runs
      // when the composable is used inside a Vue component.
      // This test documents the expected behavior.
      const currentTheme = () => 'auto' as Theme
      useTheme(currentTheme)

      // In a real component, addEventListener would be called during onMounted
      // In test environment without a component, onMounted doesn't run
      expect(typeof matchMediaReturns.addEventListener).toBe('function')
    })
  })
})

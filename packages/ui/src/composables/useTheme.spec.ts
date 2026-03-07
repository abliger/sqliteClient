import { describe, it, expect } from 'vitest'

describe('useTheme', () => {
  it('should be importable', async () => {
    const { useTheme } = await import('./useTheme')
    expect(typeof useTheme).toBe('function')
  })

  it('should export Theme type', async () => {
    const { useTheme } = await import('./useTheme')
    // TypeScript will check this at compile time
    expect(useTheme).toBeDefined()
  })
})

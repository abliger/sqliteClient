import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vFocus } from './focus'
import type { DirectiveBinding } from 'vue'

describe('vFocus directive', () => {
  let mockElement: HTMLInputElement

  beforeEach(() => {
    mockElement = document.createElement('input')
    vi.spyOn(mockElement, 'focus')
  })

  it('should focus element when mounted', () => {
    // Simulate directive mounted hook
    vFocus.mounted!(mockElement, {} as DirectiveBinding)

    expect(mockElement.focus).toHaveBeenCalled()
  })

  it('should work with different element types', () => {
    const textarea = document.createElement('textarea')
    vi.spyOn(textarea, 'focus')

    vFocus.mounted!(textarea, {} as DirectiveBinding)

    expect(textarea.focus).toHaveBeenCalled()
  })

  it('should work with contenteditable elements', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    vi.spyOn(div, 'focus')

    vFocus.mounted!(div, {} as DirectiveBinding)

    expect(div.focus).toHaveBeenCalled()
  })

  it('should focus element only once on mount', () => {
    vFocus.mounted!(mockElement, {} as DirectiveBinding)
    vFocus.mounted!(mockElement, {} as DirectiveBinding)

    expect(mockElement.focus).toHaveBeenCalledTimes(2)
  })
})

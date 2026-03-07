import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Tooltip from './Tooltip.vue'

describe('Tooltip Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render slot content', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Test tooltip',
      },
      slots: {
        default: '<button>Hover me</button>',
      },
    })

    expect(wrapper.text()).toContain('Hover me')
  })

  it('should accept position prop', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Test tooltip',
        position: 'top',
      },
      slots: {
        default: '<button>Hover me</button>',
      },
    })

    expect(wrapper.props('position')).toBe('top')
  })

  it('should accept delay prop', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Test tooltip',
        delay: 500,
      },
      slots: {
        default: '<button>Hover me</button>',
      },
    })

    expect(wrapper.props('delay')).toBe(500)
  })

  it('should show tooltip on mouse enter after delay', async () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Test tooltip',
        delay: 200,
      },
      slots: {
        default: '<button>Hover me</button>',
      },
    })

    // Initially not visible
    expect(wrapper.vm.isVisible).toBe(false)

    // Trigger mouse enter on the trigger div
    await wrapper.find('.inline-flex').trigger('mouseenter')
    
    // Should not be visible immediately
    expect(wrapper.vm.isVisible).toBe(false)

    // Advance timer
    vi.advanceTimersByTime(250)
    await nextTick()

    // Should be visible after delay
    expect(wrapper.vm.isVisible).toBe(true)
  })

  it('should hide tooltip on mouse leave', async () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Test tooltip',
        delay: 0,
      },
      slots: {
        default: '<button>Hover me</button>',
      },
    })

    // Show tooltip
    await wrapper.find('.inline-flex').trigger('mouseenter')
    vi.advanceTimersByTime(10)
    await nextTick()
    expect(wrapper.vm.isVisible).toBe(true)

    // Hide tooltip
    await wrapper.find('.inline-flex').trigger('mouseleave')
    expect(wrapper.vm.isVisible).toBe(false)
  })
})

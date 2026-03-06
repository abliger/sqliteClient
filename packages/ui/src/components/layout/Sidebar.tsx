import { defineComponent, ref } from 'vue'

interface SidebarProps {
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

export default defineComponent({
  name: 'Sidebar',
  props: {
    defaultWidth: { type: Number, default: 280 },
    minWidth: { type: Number, default: 200 },
    maxWidth: { type: Number, default: 500 }
  },
  setup(props: SidebarProps, { slots }) {
    const width = ref(props.defaultWidth!)
    const isResizing = ref(false)

    const startResize = (e: MouseEvent) => {
      isResizing.value = true
      const startX = e.clientX
      const startWidth = width.value

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.value) return
        const delta = e.clientX - startX
        const newWidth = Math.max(
          props.minWidth!,
          Math.min(props.maxWidth!, startWidth + delta)
        )
        width.value = newWidth
      }

      const handleMouseUp = () => {
        isResizing.value = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => (
      <div
        class="relative flex-shrink-0 bg-white border-r border-surface-200 flex flex-col"
        style={{ width: `${width.value}px` }}
      >
        {/* 内容区域 */}
        <div class="flex-1 overflow-hidden">
          {slots.default?.()}
        </div>

        {/* 调整大小的手柄 */}
        <div
          class={[
            'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 transition-colors',
            isResizing.value ? 'bg-primary-500' : 'bg-transparent'
          ]}
          onMousedown={startResize}
        />
      </div>
    )
  }
})

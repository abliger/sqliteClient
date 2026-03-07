<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
  delay: 200
})

const isVisible = ref(false)
const timeoutId = ref<number | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref({ top: '0px', left: '0px' })
const tooltipId = ref(`tooltip-${Math.random().toString(36).substr(2, 9)}`)

const show = async () => {
  if (timeoutId.value) {
    clearTimeout(timeoutId.value)
  }
  timeoutId.value = window.setTimeout(async () => {
    isVisible.value = true
    await nextTick()
    updatePosition()
  }, props.delay)
}

const hide = () => {
  if (timeoutId.value) {
    clearTimeout(timeoutId.value)
    timeoutId.value = null
  }
  isVisible.value = false
}

const updatePosition = () => {
  if (!triggerRef.value) return
  
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const tooltipEl = document.querySelector(`[data-tooltip-id="${tooltipId.value}"]`) as HTMLElement
  
  if (!tooltipEl) return
  
  const tooltipRect = tooltipEl.getBoundingClientRect()
  const margin = 8
  
  let top = 0
  let left = 0
  
  switch (props.position) {
    case 'bottom':
      top = triggerRect.bottom + margin
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
      break
    case 'top':
      top = triggerRect.top - tooltipRect.height - margin
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
      break
    case 'left':
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
      left = triggerRect.left - tooltipRect.width - margin
      break
    case 'right':
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
      left = triggerRect.right + margin
      break
  }
  
  // Boundary check - keep inside viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // Adjust horizontal position
  if (left < margin) {
    left = margin
  } else if (left + tooltipRect.width > viewportWidth - margin) {
    left = viewportWidth - tooltipRect.width - margin
  }
  
  // Adjust vertical position
  if (top < margin) {
    top = margin
  } else if (top + tooltipRect.height > viewportHeight - margin) {
    top = viewportHeight - tooltipRect.height - margin
  }
  
  tooltipStyle.value = { top: `${top}px`, left: `${left}px` }
}

const arrowStyle = computed(() => {
  if (!triggerRef.value) return {}
  
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const tooltipTop = parseInt(tooltipStyle.value.top)
  const tooltipLeft = parseInt(tooltipStyle.value.left)
  
  let arrowTop = 'auto'
  let arrowLeft = 'auto'
  let arrowTransform = ''
  
  switch (props.position) {
    case 'bottom':
      arrowTop = '-4px'
      arrowLeft = `${triggerRect.left + triggerRect.width / 2 - tooltipLeft - 4}px`
      arrowTransform = 'rotate(45deg)'
      break
    case 'top':
      arrowTop = 'auto'
      arrowLeft = `${triggerRect.left + triggerRect.width / 2 - tooltipLeft - 4}px`
      arrowTransform = 'rotate(45deg)'
      break
    case 'left':
      arrowTop = `${triggerRect.top + triggerRect.height / 2 - tooltipTop - 4}px`
      arrowLeft = 'auto'
      arrowTransform = 'rotate(45deg)'
      break
    case 'right':
      arrowTop = `${triggerRect.top + triggerRect.height / 2 - tooltipTop - 4}px`
      arrowLeft = '-4px'
      arrowTransform = 'rotate(45deg)'
      break
  }
  
  return {
    top: arrowTop,
    left: arrowLeft,
    bottom: props.position === 'top' ? '-4px' : 'auto',
    right: props.position === 'left' ? '-4px' : 'auto',
    transform: arrowTransform
  }
})

// Update position on scroll/resize
onMounted(() => {
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div
    ref="triggerRef"
    class="inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
  >
    <slot />
  </div>
  
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isVisible"
        :data-tooltip-id="tooltipId"
        :style="tooltipStyle"
        class="fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-surface-800 dark:bg-surface-700 rounded shadow-lg whitespace-nowrap pointer-events-none"
      >
        {{ content }}
        <!-- Arrow -->
        <div
          class="absolute w-2 h-2 bg-surface-800 dark:bg-surface-700"
          :style="arrowStyle"
        />
      </div>
    </Transition>
  </Teleport>
</template>

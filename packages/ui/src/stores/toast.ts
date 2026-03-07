import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  // State
  const toasts = ref<Toast[]>([])
  const maxToasts = 5

  // Getters
  const visibleToasts = computed(() => toasts.value.slice(0, maxToasts))

  // Actions
  function addToast(toast: Omit<Toast, 'id'>): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    }

    // Remove oldest if at max
    if (toasts.value.length >= maxToasts) {
      toasts.value.pop()
    }

    toasts.value.unshift(newToast)

    // Auto dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function clearAll() {
    toasts.value = []
  }

  // Convenience methods
  function success(title: string, message?: string, duration?: number) {
    return addToast({ type: 'success', title, message, duration })
  }

  function error(title: string, message?: string, duration?: number) {
    return addToast({ type: 'error', title, message, duration: duration ?? 8000 })
  }

  function warning(title: string, message?: string, duration?: number) {
    return addToast({ type: 'warning', title, message, duration })
  }

  function info(title: string, message?: string, duration?: number) {
    return addToast({ type: 'info', title, message, duration })
  }

  return {
    // State
    toasts: visibleToasts,
    // Actions
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info
  }
})

import type { Directive } from 'vue'

/**
 * v-focus 指令 - 自动聚焦元素
 * 用法: <input v-focus />
 */
export const vFocus: Directive = {
  mounted(el: HTMLElement) {
    el.focus()
  }
}

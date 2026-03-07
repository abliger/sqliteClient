import type { App } from 'vue'
import { vFocus } from './focus'

export function registerDirectives(app: App) {
  app.directive('focus', vFocus)
}

export { vFocus }

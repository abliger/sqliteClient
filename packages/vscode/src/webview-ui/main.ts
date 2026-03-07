import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './vscode-api'

// Import Tailwind CSS and styles from UI package
import '../../../ui/src/styles/index.css'

// Import i18n and directives
import { i18n } from '@i18n/index'
import { registerDirectives } from '@directives/index'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
registerDirectives(app)
app.mount('#app')

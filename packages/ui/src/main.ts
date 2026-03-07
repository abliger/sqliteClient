import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from '@i18n/index'
import { registerDirectives } from '@directives/index'
import './styles/index.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
registerDirectives(app)
app.mount('#app')

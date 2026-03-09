import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from '@i18n/index'
import { registerDirectives } from '@directives/index'
import { initializePlatform } from '@services/platform'
import { registerAllProviders } from '@services/platform/providers'
import './styles/index.css'

async function bootstrap() {
    // 注册所有平台 Provider
    registerAllProviders()

    // 初始化平台适配器
    await initializePlatform()

    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    app.use(i18n)
    registerDirectives(app)

    app.mount('#app')
}

bootstrap()

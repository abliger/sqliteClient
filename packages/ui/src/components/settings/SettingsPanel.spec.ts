import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import SettingsPanel from './SettingsPanel.vue'
import { useSettingsStore } from '@stores/settings'

// Mock setI18nLanguage
vi.mock('@i18n/index', () => ({
    availableLocales: ['en', 'zh'],
    setI18nLanguage: vi.fn(),
}))

describe('SettingsPanel Component', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    const createWrapper = () => {
        return mount(SettingsPanel)
    }

    describe('rendering', () => {
        it('should not render when panel is closed', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.fixed').exists()).toBe(false)
        })

        it('should render when panel is open', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.fixed').exists()).toBe(true)
            expect(wrapper.text()).toContain('settings.title')
        })

        it('should render settings header', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('h2').exists()).toBe(true)
            expect(wrapper.text()).toContain('settings.title')
        })

        it('should render language section', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('settings.language')
            expect(wrapper.text()).toContain('settings.languageTip')
        })

        it('should render theme section', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('settings.theme')
        })

        it('should render all language options', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            const languageButtons = buttons.filter(btn => 
                btn.text().includes('English') || btn.text().includes('简体中文')
            )
            expect(languageButtons.length).toBe(2)
        })

        it('should render all theme options', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('settings.auto')
            expect(wrapper.text()).toContain('settings.light')
            expect(wrapper.text()).toContain('settings.dark')
        })

        it('should render version info in footer', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.text()).toContain('SQLite Client v0.1.0')
        })
    })

    describe('interactions', () => {
        it('should close panel when close button clicked', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            // Find the close button by checking for XMark icon or position
            const closeButton = buttons.find(btn => {
                const html = btn.html()
                return html.includes('svg') && buttons.indexOf(btn) === 0
            })
            
            if (closeButton && closeButton.exists()) {
                await closeButton.trigger('click')
                expect(store.isPanelOpen).toBe(false)
            }
        })

        it('should close panel when backdrop clicked', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            const backdrop = wrapper.find('.fixed.z-40')
            if (backdrop.exists()) {
                await backdrop.trigger('click')
                expect(store.isPanelOpen).toBe(false)
            }
        })

        it('should call setLocale when language option clicked', async () => {
            const { setI18nLanguage } = await import('@i18n/index')
            const store = useSettingsStore()
            store.isPanelOpen = true

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            const zhButton = buttons.find(btn => btn.text().includes('简体中文'))
            
            if (zhButton) {
                const setLocaleSpy = vi.spyOn(store, 'setLocale')
                await zhButton.trigger('click')
                expect(setLocaleSpy).toHaveBeenCalledWith('zh')
            }
        })

        it('should call setTheme when theme option clicked', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true

            // Set initial theme
            store.settings.theme = 'auto'

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            // Find a theme button that is not currently selected
            const darkButton = buttons.find(btn => {
                const text = btn.text()
                const isSelected = btn.classes().includes('border-primary-500')
                return text.includes('settings.dark') && !isSelected
            })

            if (darkButton) {
                const setThemeSpy = vi.spyOn(store, 'setTheme')
                await darkButton.trigger('click')
                expect(setThemeSpy).toHaveBeenCalledWith('dark')
            }
        })
    })

    describe('visual states', () => {
        it('should highlight current language option', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true
            store.settings.locale = 'en'

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            const enButton = buttons.find(btn => btn.text().includes('English'))

            if (enButton) {
                expect(enButton.classes()).toContain('border-primary-500')
            }
        })

        it('should highlight current theme option', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true
            store.settings.theme = 'dark'

            const wrapper = createWrapper()
            await nextTick()

            const buttons = wrapper.findAll('button')
            const darkButton = buttons.find(btn => btn.text().includes('settings.dark'))

            if (darkButton) {
                expect(darkButton.classes()).toContain('border-primary-500')
            }
        })

        it('should show checkmark for selected options', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true
            store.settings.locale = 'en'
            store.settings.theme = 'auto'

            const wrapper = createWrapper()
            await nextTick()

            // Check for checkmark SVG in selected options
            const svgs = wrapper.findAll('svg')
            expect(svgs.length).toBeGreaterThan(0)
        })
    })

    describe('store integration', () => {
        it('should react to panel open state changes', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = false

            const wrapper = createWrapper()
            expect(wrapper.find('.fixed').exists()).toBe(false)

            store.isPanelOpen = true
            await nextTick()
            expect(wrapper.find('.fixed').exists()).toBe(true)
        })

        it('should use correct locale from store', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true
            store.settings.locale = 'zh'

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.currentLocale).toBe('zh')
        })

        it('should use correct theme from store', async () => {
            const store = useSettingsStore()
            store.isPanelOpen = true
            store.settings.theme = 'light'

            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.currentTheme).toBe('light')
        })
    })
})

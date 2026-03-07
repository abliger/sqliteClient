import { createI18n } from 'vue-i18n'
import { locales, defaultLocale, type LocaleType } from './locales'

// Create messages object from locales
const messages = Object.entries(locales).reduce(
    (acc, [key, value]) => {
        acc[key] = value.messages
        return acc
    },
    {} as Record<string, (typeof locales)['en']['messages']>,
)

export const i18n = createI18n({
    legacy: false, // Use Composition API
    locale: defaultLocale,
    fallbackLocale: 'en',
    messages,
    globalInjection: true,
})

export function setI18nLanguage(locale: LocaleType) {
    i18n.global.locale.value = locale
    document.querySelector('html')?.setAttribute('lang', locale)
}

export { defaultLocale, type LocaleType }
export { locales, availableLocales } from './locales'

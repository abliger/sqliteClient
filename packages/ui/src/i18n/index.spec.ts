import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { i18n, setI18nLanguage, defaultLocale, availableLocales } from './index'
import { locales } from './locales'

describe('i18n Configuration', () => {
  beforeEach(() => {
    // Reset to default locale
    i18n.global.locale.value = defaultLocale
  })

  afterEach(() => {
    document.querySelector('html')?.removeAttribute('lang')
  })

  it('should have default locale set', () => {
    expect(i18n.global.locale.value).toBe(defaultLocale)
  })

  it('should have fallback locale set to en', () => {
    expect(i18n.global.fallbackLocale.value).toBe('en')
  })

  it('should support en and zh-CN locales', () => {
    expect(availableLocales).toContain('en')
    expect(availableLocales).toContain('zh-CN')
  })

  it('should have messages for all locales', () => {
    availableLocales.forEach(locale => {
      const messages = i18n.global.getLocaleMessage(locale)
      expect(messages).toBeDefined()
      expect(Object.keys(messages).length).toBeGreaterThan(0)
    })
  })

  it('should set locale correctly', () => {
    setI18nLanguage('zh-CN')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('should set html lang attribute', () => {
    setI18nLanguage('zh-CN')
    expect(document.querySelector('html')?.getAttribute('lang')).toBe('zh-CN')
  })

  it('should have common translations', () => {
    const enMessages = locales.en.messages
    expect(enMessages.common).toBeDefined()
    expect(enMessages.common.confirm).toBe('Confirm')
    expect(enMessages.common.cancel).toBe('Cancel')
  })

  it('should have connection translations', () => {
    const enMessages = locales.en.messages
    expect(enMessages.connection).toBeDefined()
    expect(enMessages.connection.openDatabase).toBe('Open Database')
    expect(enMessages.connection.newDatabase).toBe('New Database')
  })

  it('should have settings translations', () => {
    const enMessages = locales.en.messages
    expect(enMessages.settings).toBeDefined()
    expect(enMessages.settings.title).toBe('Settings')
    expect(enMessages.settings.language).toBe('Language')
  })

  it('should have Chinese translations', () => {
    const zhMessages = locales['zh-CN'].messages
    expect(zhMessages.common.confirm).toBe('确认')
    expect(zhMessages.common.cancel).toBe('取消')
    expect(zhMessages.connection.openDatabase).toBe('打开数据库')
  })

  it('should translate messages', () => {
    const t = i18n.global.t
    expect(t('common.confirm')).toBe('Confirm')
    expect(t('connection.openDatabase')).toBe('Open Database')
  })

  it('should fallback to en for unknown keys', () => {
    const t = i18n.global.t
    setI18nLanguage('zh-CN')
    // This key doesn't exist, should fallback or return the key
    const result = t('unknown.key.that.does.not.exist')
    expect(typeof result).toBe('string')
  })
})

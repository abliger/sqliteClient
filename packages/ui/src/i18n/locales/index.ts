import en from './en'
import zhCN from './zh-CN'

export type LocaleType = 'en' | 'zh-CN'

export const locales: { [key in LocaleType]: { name: string; label: string; messages: typeof en } } = {
  'en': {
    name: 'English',
    label: 'English',
    messages: en,
  },
  'zh-CN': {
    name: '简体中文',
    label: '简体中文',
    messages: zhCN,
  },
}

export const defaultLocale: LocaleType = 'en'

export const availableLocales: LocaleType[] = ['en', 'zh-CN']

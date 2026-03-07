<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@stores/settings'
import { availableLocales, type LocaleType, setI18nLanguage } from '@i18n/index'
import { XMarkIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline'

const { t, locale: i18nLocale } = useI18n()
const settingsStore = useSettingsStore()

const currentLocale = computed(() => settingsStore.locale)
const currentTheme = computed(() => settingsStore.theme)

const languageOptions = computed(() => {
  return availableLocales.map((locale) => ({
    value: locale,
    label: locale === 'en' ? 'English' : '简体中文',
  }))
})

const themeOptions = [
  { value: 'auto', label: t('settings.auto') },
  { value: 'light', label: t('settings.light') },
  { value: 'dark', label: t('settings.dark') },
]

const handleLocaleChange = async (newLocale: LocaleType) => {
  setI18nLanguage(newLocale)
  await settingsStore.setLocale(newLocale)
}

const handleThemeChange = async (newTheme: 'auto' | 'light' | 'dark') => {
  await settingsStore.setTheme(newTheme)
}

const closePanel = () => {
  settingsStore.closeSettingsPanel()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-x-full"
    enter-to-class="opacity-100 translate-x-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 translate-x-full"
  >
    <div
      v-if="settingsStore.isPanelOpen"
      class="fixed inset-y-0 right-0 w-80 bg-white shadow-xl border-l border-surface-200 z-50 flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-surface-50">
        <div class="flex items-center space-x-2">
          <Cog6ToothIcon class="w-5 h-5 text-surface-600" />
          <h2 class="text-lg font-semibold text-surface-900">
            {{ t('settings.title') }}
          </h2>
        </div>
        <button
          class="p-1.5 rounded hover:bg-surface-200 text-surface-500"
          @click="closePanel"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Language Setting -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-surface-700">
            {{ t('settings.language') }}
          </label>
          <p class="text-xs text-surface-500">
            {{ t('settings.languageTip') }}
          </p>
          <div class="space-y-2">
            <button
              v-for="option in languageOptions"
              :key="option.value"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
              :class="currentLocale === option.value
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'"
              @click="handleLocaleChange(option.value)"
            >
              <span class="text-sm">{{ option.label }}</span>
              <div
                v-if="currentLocale === option.value"
                class="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center"
              >
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-surface-200" />

        <!-- Theme Setting -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-surface-700">
            {{ t('settings.theme') }}
          </label>
          <div class="space-y-2">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors"
              :class="currentTheme === option.value
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'"
              @click="handleThemeChange(option.value as 'auto' | 'light' | 'dark')"
            >
              <span class="text-sm">{{ option.label }}</span>
              <div
                v-if="currentTheme === option.value"
                class="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center"
              >
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-surface-200 bg-surface-50">
        <p class="text-xs text-surface-500 text-center">
          SQLite Client v0.1.0
        </p>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="settingsStore.isPanelOpen"
      class="fixed inset-0 bg-black/20 z-40"
      @click="closePanel"
    />
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PlayIcon, PlayCircleIcon, SparklesIcon, DocumentArrowUpIcon, BookmarkSquareIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()

interface Props {
    isExecuting?: boolean
    canExecute?: boolean
    isSidebarVisible?: boolean
}

withDefaults(defineProps<Props>(), {
    isExecuting: false,
    canExecute: false
})

const emit = defineEmits<{
    execute: []
    executeSelected: []
    format: []
    importSql: []
    toggleTemplates: []
    toggleSidebar: []
}>()
</script>

<template>
    <div
        class="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
    >
        <div class="flex items-center space-x-2">
            <!-- Execute Button -->
            <button
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canExecute || isExecuting"
                :title="t('editor.execute')"
                @click="emit('execute')"
            >
                <PlayIcon class="w-4 h-4 mr-1.5" />
                {{ isExecuting ? t('editor.running') : t('editor.run') }}
            </button>

            <button
                class="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canExecute || isExecuting"
                :title="t('editor.runSelectedQuery')"
                @click="emit('executeSelected')"
            >
                <PlayCircleIcon class="w-4 h-4 mr-1.5" />
                {{ t('editor.runSelected') }}
            </button>

            <div class="w-px h-6 bg-surface-300 dark:bg-surface-600 mx-2" />

            <!-- Import SQL -->
            <button
                class="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canExecute"
                :title="t('editor.importSql')"
                @click="emit('importSql')"
            >
                <DocumentArrowUpIcon class="w-4 h-4 mr-1.5" />
                {{ t('editor.import') }}
            </button>

            <!-- Format -->
            <button class="btn-ghost" :title="t('editor.formatSQL')" @click="emit('format')">
                <SparklesIcon class="w-4 h-4 mr-1.5" />
                {{ t('editor.format') }}
            </button>

            <div class="w-px h-6 bg-surface-300 dark:bg-surface-600 mx-2" />

            <!-- Templates -->
            <button
                class="btn-ghost"
                :title="t('editor.templates')"
                @click="emit('toggleTemplates')"
            >
                <BookmarkSquareIcon class="w-4 h-4 mr-1.5" />
                {{ t('editor.snippets') }}
            </button>
        </div>

        <div class="flex items-center space-x-3">
            <!-- Toggle Sidebar Button -->
            <button
                class="p-1.5 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
                :title="isSidebarVisible ? t('editor.hideSidebar') : t('editor.showSidebar')"
                @click="emit('toggleSidebar')"
            >
                <component
                    :is="isSidebarVisible ? ChevronRightIcon : ChevronLeftIcon"
                    class="w-4 h-4"
                />
            </button>

            <div class="h-4 w-px bg-surface-300 dark:bg-surface-600" />

            <!-- Shortcut Hints -->
            <div class="flex items-center space-x-2 text-xs text-surface-500 dark:text-surface-400">
                <span>{{ t('editor.shortcutHint') }}</span>
                <span>•</span>
                <span>{{ t('editor.commentShortcut') }}</span>
            </div>
        </div>
    </div>
</template>

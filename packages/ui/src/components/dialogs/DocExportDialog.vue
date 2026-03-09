<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlatformAsync } from '@services/platform'
import { exportDatabaseDoc, copyDocToClipboard, generateMarkdown, type DocFormat, type DocExportOptions } from '@services/exportDocs'
import { useToastStore } from '@stores/toast'
import type { TableInfo } from '@types'
import { DocumentTextIcon, ClipboardDocumentIcon, XMarkIcon } from '@heroicons/vue/24/outline'

interface Props {
    modelValue: boolean
    databaseName: string
    tables: TableInfo[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const { platform } = usePlatformAsync()

// 导出选项
const format = ref<DocFormat>('markdown')
const includeRowCount = ref(false)
const includeIndexes = ref(true)
const includeForeignKeys = ref(true)
const isExporting = ref(false)
const isCopying = ref(false)

// 预览内容
const showPreview = ref(false)
const previewContent = ref('')

const options = computed<DocExportOptions>(() => ({
    format: format.value,
    includeRowCount: includeRowCount.value,
    includeIndexes: includeIndexes.value,
    includeForeignKeys: includeForeignKeys.value,
    includeDescription: false
}))

// 格式选项
const formatOptions = [
    { value: 'markdown' as DocFormat, label: 'Markdown', desc: '适合 GitHub、文档站点' },
    { value: 'html' as DocFormat, label: 'HTML', desc: '适合浏览器查看、打印' },
    { value: 'json' as DocFormat, label: 'JSON', desc: '适合程序处理' }
]

function close() {
    emit('update:modelValue', false)
    // 重置状态
    setTimeout(() => {
        showPreview.value = false
        previewContent.value = ''
    }, 300)
}

async function handleExport() {
    if (!platform.value?.fs) {
        toastStore.error('Not available', 'Export is only available in desktop app')
        return
    }
    
    isExporting.value = true
    try {
        await exportDatabaseDoc(
            '', // connectionId 在导出服务中不需要
            props.databaseName,
            props.tables,
            options.value
        )
        toastStore.success(t('docExport.success'))
        close()
    } catch (err) {
        console.error('Export failed:', err)
        toastStore.error(t('docExport.error'), String(err))
    } finally {
        isExporting.value = false
    }
}

async function handleCopy() {
    if (platform.value?.capabilities.clipboard !== 'full') {
        toastStore.error('Not available', 'Clipboard is not available')
        return
    }
    
    isCopying.value = true
    try {
        await copyDocToClipboard(
            props.databaseName,
            props.tables,
            options.value
        )
        toastStore.success(t('docExport.copied'))
    } catch (err) {
        console.error('Copy failed:', err)
        toastStore.error(t('docExport.copyError'), String(err))
    } finally {
        isCopying.value = false
    }
}

async function handlePreview() {
    previewContent.value = generateMarkdown(
        {
            databaseName: props.databaseName,
            tables: props.tables,
            exportedAt: new Date().toLocaleString('zh-CN')
        },
        options.value
    )
    showPreview.value = true
}

function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
        close()
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div
                v-if="modelValue"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                @click.self="handleBackdropClick"
            >
                <div class="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <!-- Header -->
                    <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700 shrink-0">
                        <div class="flex items-center space-x-2">
                            <DocumentTextIcon class="w-5 h-5 text-primary-500" />
                            <h2 class="text-lg font-semibold text-surface-900 dark:text-white">
                                {{ t('docExport.title') }}
                            </h2>
                        </div>
                        <button
                            class="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                            @click="close"
                        >
                            <XMarkIcon class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="p-6 overflow-y-auto flex-1">
                        <!-- 数据库信息 -->
                        <div class="mb-6 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
                            <div class="text-sm text-surface-500 dark:text-surface-400">
                                {{ t('docExport.database') }}
                            </div>
                            <div class="text-lg font-medium text-surface-900 dark:text-white">
                                {{ databaseName }}
                            </div>
                            <div class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                                {{ tables.length }} {{ t('docExport.tables') }}
                            </div>
                        </div>

                        <!-- 格式选择 -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                                {{ t('docExport.format') }}
                            </label>
                            <div class="grid grid-cols-3 gap-3">
                                <button
                                    v-for="opt in formatOptions"
                                    :key="opt.value"
                                    class="p-3 text-left border-2 rounded-lg transition-colors"
                                    :class="format === opt.value 
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                                        : 'border-surface-200 dark:border-surface-600 hover:border-surface-300'"
                                    @click="format = opt.value"
                                >
                                    <div class="font-medium text-surface-900 dark:text-white">
                                        {{ opt.label }}
                                    </div>
                                    <div class="text-xs text-surface-500 dark:text-surface-400 mt-1">
                                        {{ opt.desc }}
                                    </div>
                                </button>
                            </div>
                        </div>

                        <!-- 选项 -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                                {{ t('docExport.options') }}
                            </label>
                            <div class="space-y-3">
                                <label class="flex items-center">
                                    <input
                                        v-model="includeIndexes"
                                        type="checkbox"
                                        class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                    >
                                    <span class="ml-2 text-sm text-surface-700 dark:text-surface-300">
                                        {{ t('docExport.includeIndexes') }}
                                    </span>
                                </label>
                                <label class="flex items-center">
                                    <input
                                        v-model="includeForeignKeys"
                                        type="checkbox"
                                        class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                    >
                                    <span class="ml-2 text-sm text-surface-700 dark:text-surface-300">
                                        {{ t('docExport.includeForeignKeys') }}
                                    </span>
                                </label>
                            </div>
                        </div>

                        <!-- 预览 -->
                        <div v-if="showPreview" class="mt-4">
                            <div class="flex items-center justify-between mb-2">
                                <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
                                    {{ t('docExport.preview') }}
                                </label>
                                <button
                                    class="text-xs text-primary-600 hover:text-primary-700"
                                    @click="showPreview = false"
                                >
                                    {{ t('common.hide') }}
                                </button>
                            </div>
                            <pre class="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg text-xs text-surface-700 dark:text-surface-300 overflow-auto max-h-60 whitespace-pre-wrap">{{ previewContent }}</pre>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex justify-between items-center px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 shrink-0">
                        <button
                            class="btn-ghost text-sm"
                            @click="handlePreview"
                        >
                            {{ showPreview ? t('docExport.hidePreview') : t('docExport.showPreview') }}
                        </button>
                        <div class="flex space-x-2">
                            <button
                                class="btn-secondary"
                                :disabled="isCopying"
                                @click="handleCopy"
                            >
                                <ClipboardDocumentIcon class="w-4 h-4 mr-1" />
                                {{ isCopying ? t('common.copying') : t('common.copy') }}
                            </button>
                            <button
                                class="btn-primary"
                                :disabled="isExporting"
                                @click="handleExport"
                            >
                                {{ isExporting ? t('docExport.exporting') : t('docExport.export') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { importService, createDefaultImportConfig, generateColumnMappings } from '@services/import'
import { useToastStore } from './toast'
import type { ImportPreview, ImportConfig, ImportResult, ColumnMapping } from '@services/import'

export const useImportStore = defineStore('import', () => {
    const { t } = useI18n()
    const toastStore = useToastStore()

    // State
    const isOpen = ref(false)
    const isLoading = ref(false)
    const currentStep = ref<'file' | 'mapping' | 'preview' | 'importing'>('file')

    // 文件相关
    const filePath = ref('')
    const fileType = ref('')
    const fileName = ref('')

    // 预览数据
    const preview = ref<ImportPreview | null>(null)

    // 导入配置
    const config = ref<ImportConfig>(createDefaultImportConfig())

    // 导入结果
    const result = ref<ImportResult | null>(null)
    const error = ref<string | null>(null)

    // Getters
    const canProceed = computed(() => {
        switch (currentStep.value) {
            case 'file':
                return !!filePath.value && !!fileType.value
            case 'mapping':
                return (
                    config.value.table_name.trim().length > 0 &&
                    config.value.column_mappings.length > 0 &&
                    config.value.column_mappings.every(m => m.target_column.trim().length > 0)
                )
            case 'preview':
                return true
            default:
                return false
        }
    })

    const progressText = computed(() => {
        const steps = { file: '1/3', mapping: '2/3', preview: '3/3', importing: '3/3' }
        return steps[currentStep.value]
    })

    // Actions
    function openWizard() {
        isOpen.value = true
        resetState()
    }

    function closeWizard() {
        isOpen.value = false
        resetState()
    }

    function resetState() {
        currentStep.value = 'file'
        filePath.value = ''
        fileType.value = ''
        fileName.value = ''
        preview.value = null
        config.value = createDefaultImportConfig()
        result.value = null
        error.value = null
        isLoading.value = false
    }

    function setFile(path: string, type: string, name: string) {
        filePath.value = path
        fileType.value = type
        fileName.value = name
    }

    async function parseFile() {
        if (!filePath.value || !fileType.value) return

        isLoading.value = true
        error.value = null

        try {
            preview.value = await importService.parseImportFile(filePath.value, fileType.value)
            // 生成默认列映射
            if (preview.value) {
                const baseName = fileName.value.replace(/\.[^/.]+$/, '')
                config.value.table_name = sanitizeTableName(baseName)
                config.value.column_mappings = generateColumnMappings(
                    preview.value,
                    config.value.table_name,
                )
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to parse file'
            error.value = message
            toastStore.error(t('import.error'), message)
        } finally {
            isLoading.value = false
        }
    }

    function goToStep(step: 'file' | 'mapping' | 'preview' | 'importing') {
        currentStep.value = step
    }

    function nextStep() {
        const steps: ('file' | 'mapping' | 'preview' | 'importing')[] = [
            'file',
            'mapping',
            'preview',
        ]
        const currentIndex = steps.indexOf(currentStep.value)
        if (currentIndex < steps.length - 1) {
            currentStep.value = steps[currentIndex + 1]
        }
    }

    function previousStep() {
        const steps: ('file' | 'mapping' | 'preview' | 'importing')[] = [
            'file',
            'mapping',
            'preview',
        ]
        const currentIndex = steps.indexOf(currentStep.value)
        if (currentIndex > 0) {
            currentStep.value = steps[currentIndex - 1]
        }
    }

    function updateColumnMapping(index: number, mapping: Partial<ColumnMapping>) {
        if (config.value.column_mappings[index]) {
            config.value.column_mappings[index] = {
                ...config.value.column_mappings[index],
                ...mapping,
            }
        }
    }

    async function executeImport(connectionId: string) {
        if (!preview.value || !config.value.table_name) return null

        isLoading.value = true
        currentStep.value = 'importing'
        error.value = null

        try {
            result.value = await importService.executeImport(
                connectionId,
                config.value,
                preview.value.rows,
            )
            return result.value
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Import failed'
            error.value = message
            toastStore.error(t('import.error'), message)
            return null
        } finally {
            isLoading.value = false
        }
    }

    function sanitizeTableName(name: string): string {
        // 移除扩展名，替换特殊字符
        let sanitized = name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .trim()

        // 确保不以数字开头
        if (/^\d/.test(sanitized)) {
            sanitized = 't_' + sanitized
        }

        // 如果为空，使用默认名
        if (!sanitized) {
            sanitized = 'imported_table'
        }

        return sanitized.toLowerCase()
    }

    return {
        // State
        isOpen,
        isLoading,
        currentStep,
        filePath,
        fileType,
        fileName,
        preview,
        config,
        result,
        error,
        // Getters
        canProceed,
        progressText,
        // Actions
        openWizard,
        closeWizard,
        resetState,
        setFile,
        parseFile,
        goToStep,
        nextStep,
        previousStep,
        updateColumnMapping,
        executeImport,
    }
})

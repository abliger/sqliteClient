<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import type { QueryRow, CellValue, TableInfo } from '@types'

const props = defineProps<{
    isOpen: boolean
    columns: string[]
    row: QueryRow | null
    tableName: string | null
    tableInfo: TableInfo | null
}>()

const emit = defineEmits<{
    close: []
    save: [data: Record<string, CellValue>]
    delete: []
}>()

const { t } = useI18n()
const formData = ref<Record<string, string>>({})
// Edit state tracking can be added here in the future

// 获取列的数据类型信息
const getColumnInfo = (colName: string) => {
    return props.tableInfo?.columns.find(c => c.name === colName)
}

// 判断列是否可编辑
const isEditable = (colName: string): boolean => {
    const colInfo = getColumnInfo(colName)
    // 主键通常不可编辑，或者需要特殊处理
    if (colInfo?.is_primary_key) return false
    return true
}

// 格式化值为字符串用于编辑
const formatValueForEdit = (value: CellValue | undefined): string => {
    if (!value) return ''
    switch (value.type) {
        case 'Null':
            return ''
        case 'Integer':
        case 'Real':
            return String(value.value)
        case 'Boolean':
            return value.value ? '1' : '0'
        case 'Text':
            return value.value
        case 'Blob':
            return value.value
        default:
            return ''
    }
}

// 将字符串转换为 CellValue
const parseValue = (value: string, colName: string): CellValue => {
    if (value === '') {
        return { type: 'Null' }
    }

    const colInfo = getColumnInfo(colName)
    const dataType = colInfo?.data_type?.toUpperCase() || 'TEXT'

    // 根据数据类型解析
    if (dataType.includes('INT') || dataType === 'INTEGER') {
        const num = parseInt(value, 10)
        if (!isNaN(num)) {
            return { type: 'Integer', value: num }
        }
    } else if (dataType === 'REAL' || dataType === 'FLOAT' || dataType === 'DOUBLE' || dataType.includes('NUMERIC')) {
        const num = parseFloat(value)
        if (!isNaN(num)) {
            return { type: 'Real', value: num }
        }
    } else if (dataType === 'BOOLEAN') {
        return { type: 'Boolean', value: value === '1' || value.toLowerCase() === 'true' }
    }

    return { type: 'Text', value }
}

// 初始化表单数据
watch(
    () => props.row,
    (newRow) => {
        if (newRow) {
            const data: Record<string, string> = {}
            props.columns.forEach(col => {
                data[col] = formatValueForEdit(newRow.values[col])
            })
            formData.value = data
        }
    },
    { immediate: true }
)

// 计算是否有修改
const hasChanges = computed(() => {
    if (!props.row) return false
    return props.columns.some(col => {
        const originalValue = formatValueForEdit(props.row!.values[col])
        return originalValue !== formData.value[col]
    })
})

const handleClose = () => {
    emit('close')
}

const handleSave = () => {
    const data: Record<string, CellValue> = {}
    props.columns.forEach(col => {
        if (isEditable(col)) {
            data[col] = parseValue(formData.value[col] || '', col)
        }
    })
    emit('save', data)
}

const handleDelete = () => {
    if (confirm(t('results.confirmDelete'))) {
        emit('delete')
    }
}

const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
        handleClose()
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="isOpen"
                class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                @click="handleBackdropClick"
            >
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 scale-95 translate-y-4"
                    enter-to-class="opacity-100 scale-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="opacity-100 scale-100 translate-y-0"
                    leave-to-class="opacity-0 scale-95 translate-y-4"
                >
                    <div
                        v-if="isOpen"
                        class="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                        @click.stop
                    >
                        <!-- Header -->
                        <div class="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
                            <div>
                                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
                                    {{ t('results.editRow') }}
                                </h2>
                                <p v-if="tableName" class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                                    {{ t('results.table') }}: {{ tableName }}
                                </p>
                            </div>
                            <button
                                class="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
                                @click="handleClose"
                            >
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 overflow-y-auto p-5 space-y-4">
                            <div
                                v-for="col in columns"
                                :key="col"
                                class="space-y-1.5"
                            >
                                <div class="flex items-center justify-between">
                                    <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
                                        {{ col }}
                                        <span
                                            v-if="getColumnInfo(col)?.is_primary_key"
                                            class="ml-1.5 text-xs text-primary-600 dark:text-primary-400"
                                        >
                                            (PK)
                                        </span>
                                        <span
                                            v-if="getColumnInfo(col)?.is_foreign_key"
                                            class="ml-1.5 text-xs text-blue-600 dark:text-blue-400"
                                        >
                                            (FK)
                                        </span>
                                    </label>
                                    <span class="text-xs text-surface-400 dark:text-surface-500">
                                        {{ getColumnInfo(col)?.data_type || 'TEXT' }}
                                        <span v-if="!getColumnInfo(col)?.nullable">*</span>
                                    </span>
                                </div>
                                <input
                                    v-model="formData[col]"
                                    type="text"
                                    :disabled="!isEditable(col)"
                                    :placeholder="getColumnInfo(col)?.nullable ? 'NULL' : ''"
                                    class="w-full px-3 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all disabled:bg-surface-100 dark:disabled:bg-surface-900 disabled:text-surface-500 dark:disabled:text-surface-500 dark:bg-surface-800 dark:text-surface-100"
                                />
                                <p
                                    v-if="getColumnInfo(col)?.default_value"
                                    class="text-xs text-surface-500 dark:text-surface-500"
                                >
                                    {{ t('results.default') }}: {{ getColumnInfo(col)?.default_value }}
                                </p>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="flex items-center justify-between px-5 py-4 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 rounded-b-xl">
                            <button
                                class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                @click="handleDelete"
                            >
                                {{ t('results.delete') }}
                            </button>
                            <div class="flex items-center space-x-3">
                                <button
                                    class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                    @click="handleClose"
                                >
                                    {{ t('common.cancel') }}
                                </button>
                                <button
                                    class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    :disabled="!hasChanges"
                                    @click="handleSave"
                                >
                                    {{ t('common.save') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

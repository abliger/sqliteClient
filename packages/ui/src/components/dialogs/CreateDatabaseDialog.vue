<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { XMarkIcon, FolderIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
    isOpen: boolean
    defaultPath?: string
}>()

const emit = defineEmits<{
    close: []
    confirm: [name: string, path: string]
}>()

const { t } = useI18n()

const dbName = ref('')
const selectedPath = ref('')
const error = ref('')

// Reset form when dialog opens
watch(
    () => props.isOpen,
    (isOpen) => {
        if (isOpen) {
            dbName.value = ''
            selectedPath.value = props.defaultPath || ''
            error.value = ''
        }
    }
)

const isValid = computed(() => {
    if (!dbName.value.trim()) return false
    if (!selectedPath.value.trim()) return false
    // Check for invalid characters in filename
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(dbName.value)) return false
    return true
})

const fullPath = computed(() => {
    if (!selectedPath.value || !dbName.value) return ''
    const path = selectedPath.value
    const separator = path.endsWith('/') ? '' : '/'
    const name = dbName.value.endsWith('.db') ? dbName.value : `${dbName.value}.db`
    return `${path}${separator}${name}`
})

const handleClose = () => {
    emit('close')
}

const handleConfirm = () => {
    if (!isValid.value) return

    const name = dbName.value.replace(/\.db$/i, '')
    emit('confirm', name, fullPath.value)
    handleClose()
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
                class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
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
                        class="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        @click.stop
                    >
                        <!-- Header -->
                        <div
                            class="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700"
                        >
                            <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
                                {{ t('connection.newDatabase') }}
                            </h2>
                            <button
                                class="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
                                @click="handleClose"
                            >
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Content -->
                        <div class="p-5 space-y-5">
                            <!-- Selected Path Display -->
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                                    {{ t('newDatabase.location') }}
                                </label>
                                <div
                                    class="flex items-center space-x-3 p-3 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700"
                                >
                                    <FolderIcon class="w-5 h-5 text-surface-500 flex-shrink-0" />
                                    <span
                                        class="text-sm text-surface-600 dark:text-surface-400 truncate flex-1"
                                        :title="selectedPath"
                                    >
                                        {{ selectedPath || t('newDatabase.noLocation') }}
                                    </span>
                                </div>
                            </div>

                            <!-- Database Name Input -->
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                                    {{ t('newDatabase.name') }}
                                </label>
                                <div class="relative">
                                    <input
                                        v-model="dbName"
                                        type="text"
                                        class="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all dark:bg-surface-900 dark:text-surface-100"
                                        :placeholder="t('newDatabase.namePlaceholder')"
                                        @keyup.enter="handleConfirm"
                                    />
                                    <span
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400 dark:text-surface-500"
                                    >
                                        .db
                                    </span>
                                </div>
                                <p class="text-xs text-surface-500 dark:text-surface-400">
                                    {{ t('newDatabase.nameHint') }}
                                </p>
                            </div>

                            <!-- Full Path Preview -->
                            <div v-if="fullPath" class="space-y-2">
                                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                                    {{ t('newDatabase.fullPath') }}
                                </label>
                                <div class="p-3 bg-surface-100 dark:bg-surface-900 rounded-lg">
                                    <code class="text-xs text-surface-600 dark:text-surface-400 break-all">
                                        {{ fullPath }}
                                    </code>
                                </div>
                            </div>

                            <!-- Error Message -->
                            <div
                                v-if="error"
                                class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                            >
                                <p class="text-sm text-red-600 dark:text-red-400">
                                    {{ error }}
                                </p>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div
                            class="flex items-center justify-end space-x-3 px-5 py-4 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700"
                        >
                            <button
                                class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                @click="handleClose"
                            >
                                {{ t('common.cancel') }}
                            </button>
                            <button
                                class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                                :disabled="!isValid"
                                @click="handleConfirm"
                            >
                                {{ t('newDatabase.create') }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

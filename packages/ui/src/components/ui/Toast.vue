<script setup lang="ts">
// Vue imports
import { useToastStore, type ToastType } from '@stores/toast'
import {
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XMarkIcon
} from '@heroicons/vue/24/outline'

const toastStore = useToastStore()

const iconMap: Record<ToastType, typeof CheckCircleIcon> = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon
}

const styleMap: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-800 dark:text-green-200',
        icon: 'text-green-500 dark:text-green-400'
    },
    error: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: 'text-red-500 dark:text-red-400'
    },
    warning: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-200',
        icon: 'text-yellow-500 dark:text-yellow-400'
    },
    info: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-200',
        icon: 'text-blue-500 dark:text-blue-400'
    }
}

const getIcon = (type: ToastType) => iconMap[type]
const getStyle = (type: ToastType) => styleMap[type]
</script>

<template>
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        <TransitionGroup
            enter-active-class="transform ease-out duration-300 transition"
            enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-for="toast in toastStore.toasts"
                :key="toast.id"
                class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 border"
                :class="[getStyle(toast.type).bg, getStyle(toast.type).border]"
            >
                <div class="p-4">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <component
                                :is="getIcon(toast.type)"
                                class="h-6 w-6"
                                :class="getStyle(toast.type).icon"
                            />
                        </div>
                        <div class="ml-3 w-0 flex-1 pt-0.5">
                            <p class="text-sm font-medium" :class="getStyle(toast.type).text">
                                {{ toast.title }}
                            </p>
                            <p
                                v-if="toast.message"
                                class="mt-1 text-sm opacity-90"
                                :class="getStyle(toast.type).text"
                            >
                                {{ toast.message }}
                            </p>
                        </div>
                        <div class="ml-4 flex flex-shrink-0">
                            <button
                                type="button"
                                class="inline-flex rounded-md opacity-60 hover:opacity-100 focus:outline-none"
                                :class="getStyle(toast.type).text"
                                @click="toastStore.removeToast(toast.id)"
                            >
                                <span class="sr-only">Close</span>
                                <XMarkIcon class="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </TransitionGroup>
    </div>
</template>

/**
 * Vue Composable for Platform Service
 * 
 * 使用方式:
 * ```vue
 * <script setup>
 * import { usePlatform, usePlatformAsync } from '@services/platform/composable'
 * 
 * // 同步使用（确保已初始化）
 * const platform = usePlatform()
 * const result = await platform.query.executeQuery({...})
 * 
 * // 异步使用（自动等待初始化）
 * const { platform, isLoading, error } = usePlatformAsync()
 * 
 * // 条件渲染
 * const canExport = computed(() => 
 *   platform.value?.capabilities.fileSystem !== 'none'
 * )
 * </script>
 * 
 * <template>
 *   <button v-if="canExport" @click="exportData">导出</button>
 *   <div v-if="isLoading">加载中...</div>
 *   <div v-if="error">{{ error.message }}</div>
 * </template>
 * ```
 */

import { computed, inject, provide, readonly, ref, shallowRef, watchEffect, type App } from 'vue'
import {
    PlatformKey,
    initializePlatform,
    usePlatform as getPlatform,
    isPlatformReady,
    usePlatformState,
    registerPlatform,
    type PlatformOptions,
    type PlatformProvider,
} from './index'

export { PlatformKey, registerPlatform }

/**
 * 同步获取平台（需在初始化后使用）
 */
export function usePlatform() {
    const platform = inject(PlatformKey)
    if (!platform) {
        // 尝试直接获取（非 Vue 上下文）
        if (isPlatformReady()) {
            return getPlatform()
        }
        throw new Error(
            'Platform not initialized. ' +
            'Call initializePlatform() in your app entry or use usePlatformProvider().'
        )
    }
    return platform
}

/**
 * 异步获取平台（自动处理初始化）
 */
export function usePlatformAsync(options?: PlatformOptions) {
    const platform = shallowRef<PlatformProvider | null>(null)
    const isLoading = ref(false)
    const error = ref<Error | null>(null)
    
    watchEffect(async () => {
        if (isPlatformReady()) {
            platform.value = getPlatform()
            return
        }
        
        isLoading.value = true
        error.value = null
        
        try {
            platform.value = await initializePlatform(options)
        } catch (e) {
            error.value = e as Error
        } finally {
            isLoading.value = false
        }
    })
    
    return {
        platform: readonly(platform),
        isLoading: readonly(isLoading),
        error: readonly(error),
        isReady: computed(() => platform.value !== null),
    }
}

/**
 * 使用平台能力
 */
export function usePlatformCapabilities() {
    const platform = usePlatform()
    return computed(() => platform.capabilities)
}

/**
 * 检查特定能力
 */
export function usePlatformCapability<K extends keyof PlatformProvider['capabilities']>(
    key: K
) {
    const capabilities = usePlatformCapabilities()
    return computed(() => capabilities.value[key])
}

/**
 * Vue Plugin - 在应用级别提供平台
 */
export function createPlatformPlugin(options?: PlatformOptions) {
    return {
        async install(app: App) {
            const platform = await initializePlatform(options)
            app.provide(PlatformKey, platform)
        },
    }
}

/**
 * 平台 Provider 组件组合式函数
 */
export function usePlatformProvider(options?: PlatformOptions) {
    const platform = shallowRef<PlatformProvider | null>(null)
    const isLoading = ref(true)
    const error = ref<Error | null>(null)
    
    const init = async () => {
        if (isPlatformReady()) {
            platform.value = getPlatform()
            isLoading.value = false
            return
        }
        
        try {
            platform.value = await initializePlatform(options)
        } catch (e) {
            error.value = e as Error
        } finally {
            isLoading.value = false
        }
    }
    
    const providePlatform = (app: App) => {
        if (platform.value) {
            app.provide(PlatformKey, platform.value)
        }
    }
    
    return {
        platform: readonly(platform),
        isLoading: readonly(isLoading),
        error: readonly(error),
        init,
        provide: providePlatform,
    }
}

// 类型导入
import type { PlatformCapabilities } from './types'

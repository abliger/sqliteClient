/**
 * Platform Service - 统一的平台适配器入口
 * 
 * 使用方式:
 * ```ts
 * // 自动检测平台
 * const platform = usePlatform()
 * 
 * // 执行查询
 * const result = await platform.query.executeQuery({...})
 * 
 * // 检查能力
 * if (platform.capabilities.fileSystem !== 'none') {
 *   // 显示导出按钮
 * }
 * ```
 */

import { ref, shallowRef, readonly, type InjectionKey, type DeepReadonly } from 'vue'
import type { PlatformProvider, PlatformName, PlatformCapabilities } from './types'

export * from './types'

// Provider 注册表
const providers = new Map<PlatformName, () => Promise<PlatformProvider>>()

export function registerPlatform(
    name: PlatformName, 
    loader: () => Promise<PlatformProvider>
) {
    providers.set(name, loader)
}

// Vue 依赖注入 Key
export const PlatformKey: InjectionKey<DeepReadonly<PlatformProvider>> = Symbol('platform')

// 全局单例
const currentProvider = shallowRef<PlatformProvider | null>(null)
const isInitializing = ref(false)
const initError = ref<Error | null>(null)

export interface PlatformOptions {
    /** 指定平台，不指定则自动检测 */
    provider?: PlatformName
    
    /** 自动检测时的优先级 */
    autoDetectOrder?: PlatformName[]
    
    /** 初始化超时时间 */
    timeout?: number
}

/**
 * 检测当前运行平台
 */
function detectPlatform(): PlatformName | null {
    // 检测 Tauri
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        return 'tauri'
    }
    
    // 检测 VS Code
    if (typeof window !== 'undefined' && window.vscode) {
        return 'vscode'
    }
    
    // 普通 Web 环境
    return 'web'
}

/**
 * 初始化平台适配器
 */
export async function initializePlatform(options: PlatformOptions = {}): Promise<PlatformProvider> {
    if (currentProvider.value) {
        return currentProvider.value
    }
    
    if (isInitializing.value) {
        // 等待初始化完成
        return new Promise((resolve, reject) => {
            const check = () => {
                if (currentProvider.value) {
                    resolve(currentProvider.value)
                } else if (initError.value) {
                    reject(initError.value)
                } else {
                    setTimeout(check, 10)
                }
            }
            check()
        })
    }
    
    isInitializing.value = true
    initError.value = null
    
    try {
        const providerName = options.provider ?? detectPlatform()
        
        if (!providerName) {
            throw new Error('Unable to detect platform and no provider specified')
        }
        
        const loader = providers.get(providerName)
        if (!loader) {
            throw new Error(`Platform provider "${providerName}" not registered`)
        }
        
        const provider = await loader()
        
        if (provider.initialize) {
            await provider.initialize()
        }
        
        currentProvider.value = provider
        return provider
    } catch (error) {
        initError.value = error as Error
        throw error
    } finally {
        isInitializing.value = false
    }
}

/**
 * 获取当前平台适配器（同步，确保已初始化）
 */
export function usePlatform(): DeepReadonly<PlatformProvider> {
    if (!currentProvider.value) {
        throw new Error('Platform not initialized. Call initializePlatform() first.')
    }
    return readonly(currentProvider.value) as DeepReadonly<PlatformProvider>
}

/**
 * 获取当前平台适配器（可能为 null）
 */
export function getPlatform(): PlatformProvider | null {
    return currentProvider.value
}

/**
 * 检查平台适配器是否已初始化
 */
export function isPlatformReady(): boolean {
    return currentProvider.value !== null
}

/**
 * 获取初始化状态
 */
export function usePlatformState() {
    return {
        isInitializing: readonly(isInitializing),
        error: readonly(initError),
    }
}

/**
 * 重置平台（主要用于测试）
 */
export async function resetPlatform(): Promise<void> {
    if (currentProvider.value?.dispose) {
        await currentProvider.value.dispose()
    }
    currentProvider.value = null
    initError.value = null
}

// 默认导出
export default {
    register: registerPlatform,
    initialize: initializePlatform,
    use: usePlatform,
    get: getPlatform,
    isReady: isPlatformReady,
    reset: resetPlatform,
}

// 从 composable 导出
export {
    usePlatformAsync,
    usePlatformCapabilities,
    usePlatformCapability,
    createPlatformPlugin,
    usePlatformProvider,
} from './composable'

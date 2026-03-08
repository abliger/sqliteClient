/**
 * Platform Providers Index
 * 
 * 使用方式:
 * ```ts
 * import { registerAllProviders, initializePlatform } from '@services/platform'
 * 
 * // 注册所有平台
 * registerAllProviders()
 * 
 * // 初始化（自动检测）
 * const platform = await initializePlatform()
 * ```
 */

import { registerPlatform } from '../index'
import type { PlatformProvider } from '../types'

// 懒加载 Providers
export async function loadTauriProvider(): Promise<PlatformProvider> {
    const { default: provider } = await import('./tauri')
    return provider
}

export async function loadVSCodeProvider(): Promise<PlatformProvider> {
    const { default: provider } = await import('./vscode')
    return provider
}

export async function loadMockProvider(options?: import('./mock').MockOptions): Promise<PlatformProvider> {
    const { createMockProvider } = await import('./mock')
    return createMockProvider(options)
}

/**
 * 注册所有平台 Provider
 */
export function registerAllProviders() {
    registerPlatform('tauri', loadTauriProvider)
    registerPlatform('vscode', loadVSCodeProvider)
    registerPlatform('mock', () => loadMockProvider())
}

/**
 * 注册指定平台
 */
export function registerTauri() {
    registerPlatform('tauri', loadTauriProvider)
}

export function registerVSCode() {
    registerPlatform('vscode', loadVSCodeProvider)
}

export function registerMock(options?: import('./mock').MockOptions) {
    registerPlatform('mock', () => loadMockProvider(options))
}

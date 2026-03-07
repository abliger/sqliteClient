import { ref, watch, onMounted } from 'vue'

export type Theme = 'auto' | 'light' | 'dark'

export function useTheme(currentTheme: () => Theme) {
    const systemDark = ref(false)

    // 检测系统主题偏好
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateTheme = () => {
        const theme = currentTheme()
        const html = document.documentElement

        if (theme === 'dark') {
            html.classList.add('dark')
        } else if (theme === 'light') {
            html.classList.remove('dark')
        } else {
            // auto mode
            if (mediaQuery.matches) {
                html.classList.add('dark')
            } else {
                html.classList.remove('dark')
            }
        }
    }

    // 监听系统主题变化
    const handleMediaChange = (e: MediaQueryListEvent) => {
        systemDark.value = e.matches
        if (currentTheme() === 'auto') {
            updateTheme()
        }
    }

    onMounted(() => {
        systemDark.value = mediaQuery.matches
        mediaQuery.addEventListener('change', handleMediaChange)
        updateTheme()
    })

    // 监听主题设置变化
    watch(currentTheme, updateTheme)

    return {
        systemDark,
        updateTheme
    }
}

<script setup lang="ts">
import { 
  PlayIcon, 
  PlayCircleIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline'

interface Props {
  isExecuting?: boolean
  canExecute?: boolean
}

withDefaults(defineProps<Props>(), {
  isExecuting: false,
  canExecute: false
})

const emit = defineEmits<{
  execute: []
  executeSelected: []
  format: []
}>()
</script>

<template>
  <div class="flex items-center justify-between px-3 py-2 border-b border-surface-200 bg-surface-50">
    <div class="flex items-center space-x-2">
      <!-- 执行按钮 -->
      <button
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!canExecute || isExecuting"
        title="Execute (Ctrl+Enter)"
        @click="emit('execute')"
      >
        <PlayIcon class="w-4 h-4 mr-1.5" />
        {{ isExecuting ? 'Running...' : 'Run' }}
      </button>

      <button
        class="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!canExecute || isExecuting"
        title="Run Selected"
        @click="emit('executeSelected')"
      >
        <PlayCircleIcon class="w-4 h-4 mr-1.5" />
        Run Selected
      </button>

      <div class="w-px h-6 bg-surface-300 mx-2" />

      <!-- 格式化 -->
      <button
        class="btn-ghost"
        title="Format SQL"
        @click="emit('format')"
      >
        <SparklesIcon class="w-4 h-4 mr-1.5" />
        Format
      </button>
    </div>

    <div class="flex items-center space-x-2 text-xs text-surface-500">
      <span>Ctrl+Enter to run</span>
      <span>•</span>
      <span>Ctrl+/ to comment</span>
    </div>
  </div>
</template>

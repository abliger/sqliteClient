<script setup lang="ts">
import type { QueryResult } from '@types'
import {
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'

interface Props {
  isExecuting?: boolean
  executionTime?: number
  result?: QueryResult
}

withDefaults(defineProps<Props>(), {
  isExecuting: false
})

const formatDuration = (ms?: number): string => {
  if (ms === undefined) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
</script>

<template>
  <div class="h-full p-4 overflow-auto">
    <!-- Executing -->
    <div
      v-if="isExecuting"
      class="flex items-center space-x-2 text-primary-600"
    >
      <div class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <span>Executing query...</span>
    </div>

    <!-- Success Result -->
    <div
      v-else-if="result"
      class="space-y-4"
    >
      <div class="flex items-center space-x-2 text-green-600">
        <InformationCircleIcon class="w-5 h-5" />
        <span class="font-medium">Query completed successfully</span>
      </div>

      <div class="bg-surface-50 rounded-lg p-4 space-y-2">
        <div class="flex items-center space-x-2 text-surface-600">
          <ClockIcon class="w-4 h-4" />
          <span>Execution time: {{ formatDuration(executionTime) }}</span>
        </div>

        <div
          v-if="result.type === 'rows'"
          class="text-surface-600"
        >
          Returned {{ result.rows.length }} rows
          <span v-if="result.has_more">(truncated)</span>
        </div>

        <template v-if="result.type === 'execution'">
          <div class="text-surface-600">
            Rows affected: <span class="font-medium">{{ result.rows_affected }}</span>
          </div>
          <div
            v-if="result.last_insert_id"
            class="text-surface-600"
          >
            Last insert ID: <span class="font-medium">{{ result.last_insert_id }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- No Result -->
    <div
      v-else
      class="text-surface-400 text-sm"
    >
      No query executed yet
    </div>
  </div>
</template>

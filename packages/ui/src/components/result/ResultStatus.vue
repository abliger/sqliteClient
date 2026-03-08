<script setup lang="ts">
import { computed } from 'vue'
import type { QueryResult, QueryExecutionInfo, QueryPlanStep } from '@types'
import {
    ClockIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    LightBulbIcon,
    ListBulletIcon,
    TableCellsIcon,
    BoltIcon
} from '@heroicons/vue/24/outline'

interface Props {
    isExecuting?: boolean
    executionTime?: number
    result?: QueryResult
}

const props = withDefaults(defineProps<Props>(), {
    isExecuting: false
})

const formatDuration = (ms?: number): string => {
    if (ms === undefined) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

const executionInfo = computed<QueryExecutionInfo | undefined>(() => {
    if (!props.result) return undefined
    return props.result.execution_info
})

const hasWarnings = computed(() => {
    return executionInfo.value?.warnings && executionInfo.value.warnings.length > 0
})

const hasSuggestions = computed(() => {
    return executionInfo.value?.suggestions && executionInfo.value.suggestions.length > 0
})

const hasQueryPlan = computed(() => {
    return executionInfo.value?.query_plan && executionInfo.value.query_plan.length > 0
})

const warningColorClass = (level: string) => {
    switch (level) {
        case 'error':
            return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
        case 'warning':
            return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
        case 'info':
            return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
        default:
            return 'text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800'
    }
}

const warningIcon = (level: string) => {
    switch (level) {
        case 'error':
            return ExclamationTriangleIcon
        case 'warning':
            return ExclamationTriangleIcon
        case 'info':
            return InformationCircleIcon
        default:
            return InformationCircleIcon
    }
}

const formatPlanStep = (step: QueryPlanStep): string => {
    const indent = '  '.repeat(step.parent !== undefined ? 1 : 0)
    return `${indent}${step.detail}`
}
</script>

<template>
    <div class="h-full p-4 overflow-auto space-y-4">
        <!-- Executing -->
        <div v-if="isExecuting" class="flex items-center space-x-2 text-primary-600">
            <div
                class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"
            />
            <span>Executing query...</span>
        </div>

        <!-- Success Result -->
        <div v-else-if="result" class="space-y-4">
            <!-- 执行状态 -->
            <div class="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircleIcon class="w-5 h-5" />
                <span class="font-medium">Query completed successfully</span>
            </div>

            <!-- 执行概览 -->
            <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 space-y-3">
                <div class="flex items-center space-x-2 text-surface-700 dark:text-surface-300">
                    <ClockIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                    <span class="font-medium">执行时间:</span>
                    <span class="font-mono">{{ formatDuration(executionInfo?.execution_time_ms) }}</span>
                </div>

                <!-- 详细时间分解 -->
                <div
                    v-if="executionInfo?.plan_time_ms || executionInfo?.query_time_ms"
                    class="pl-6 space-y-1 text-sm text-surface-600 dark:text-surface-400"
                >
                    <div v-if="executionInfo.plan_time_ms" class="flex items-center space-x-2">
                        <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span>计划分析: {{ formatDuration(executionInfo.plan_time_ms) }}</span>
                    </div>
                    <div v-if="executionInfo.query_time_ms" class="flex items-center space-x-2">
                        <span class="w-2 h-2 rounded-full bg-green-400"></span>
                        <span>实际执行: {{ formatDuration(executionInfo.query_time_ms) }}</span>
                    </div>
                </div>

                <!-- 返回行数 -->
                <div
                    v-if="result.type === 'rows'"
                    class="flex items-center space-x-2 text-surface-700 dark:text-surface-300"
                >
                    <TableCellsIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                    <span class="font-medium">返回行数:</span>
                    <span>{{ result.rows.length }} 行</span>
                    <span v-if="result.has_more" class="text-amber-600 dark:text-amber-400 text-sm">
                        (已截断)
                    </span>
                </div>

                <!-- 扫描行数 -->
                <div
                    v-if="executionInfo?.rows_scanned"
                    class="flex items-center space-x-2 text-surface-700 dark:text-surface-300"
                >
                    <ListBulletIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                    <span class="font-medium">扫描行数:</span>
                    <span>{{ executionInfo.rows_scanned }} 行</span>
                </div>

                <!-- DML 结果 -->
                <template v-if="result.type === 'execution'">
                    <div class="flex items-center space-x-2 text-surface-700 dark:text-surface-300">
                        <BoltIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                        <span class="font-medium">影响行数:</span>
                        <span>{{ result.rows_affected }}</span>
                    </div>
                    <div
                        v-if="result.last_insert_id"
                        class="flex items-center space-x-2 text-surface-700 dark:text-surface-300"
                    >
                        <span class="font-medium">Last insert ID:</span>
                        <span class="font-mono">{{ result.last_insert_id }}</span>
                    </div>
                </template>

                <!-- 索引使用信息 -->
                <div v-if="executionInfo?.used_index !== undefined" class="flex items-center space-x-2">
                    <InformationCircleIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                    <span class="font-medium">索引使用:</span>
                    <span
                        v-if="executionInfo.used_index"
                        class="text-green-600 dark:text-green-400 flex items-center space-x-1"
                    >
                        <CheckCircleIcon class="w-4 h-4" />
                        <span>使用了索引</span>
                        <span
                            v-if="executionInfo.indexes_used.length > 0"
                            class="text-surface-600 dark:text-surface-400"
                        >
                            ({{ executionInfo.indexes_used.join(', ') }})
                        </span>
                    </span>
                    <span v-else class="text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                        <ExclamationTriangleIcon class="w-4 h-4" />
                        <span>未使用索引</span>
                    </span>
                </div>

                <!-- 全表扫描警告 -->
                <div
                    v-if="executionInfo?.is_full_table_scan"
                    class="flex items-center space-x-2 text-amber-600 dark:text-amber-400"
                >
                    <ExclamationTriangleIcon class="w-4 h-4" />
                    <span class="font-medium">全表扫描</span>
                </div>
            </div>

            <!-- 警告信息 -->
            <div v-if="hasWarnings" class="space-y-2">
                <h4
                    class="font-medium text-surface-700 dark:text-surface-300 flex items-center space-x-2"
                >
                    <ExclamationTriangleIcon class="w-4 h-4" />
                    <span>警告</span>
                </h4>
                <div
                    v-for="(warning, index) in executionInfo?.warnings ?? []"
                    :key="index"
                    class="p-3 rounded-lg text-sm"
                    :class="warningColorClass(warning.level)"
                >
                    <div class="flex items-start space-x-2">
                        <component
                            :is="warningIcon(warning.level)"
                            class="w-4 h-4 mt-0.5 flex-shrink-0"
                        />
                        <div>
                            <div class="font-medium">{{ warning.message }}</div>
                            <div v-if="warning.code" class="text-xs opacity-75 mt-1">
                                代码: {{ warning.code }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 优化建议 -->
            <div v-if="hasSuggestions" class="space-y-2">
                <h4
                    class="font-medium text-surface-700 dark:text-surface-300 flex items-center space-x-2"
                >
                    <LightBulbIcon class="w-4 h-4" />
                    <span>优化建议</span>
                </h4>
                <ul class="space-y-1">
                    <li
                        v-for="(suggestion, index) in executionInfo?.suggestions ?? []"
                        :key="index"
                        class="flex items-start space-x-2 text-sm text-surface-600 dark:text-surface-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded"
                    >
                        <LightBulbIcon class="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>{{ suggestion }}</span>
                    </li>
                </ul>
            </div>

            <!-- 查询计划 -->
            <div v-if="hasQueryPlan" class="space-y-2">
                <h4
                    class="font-medium text-surface-700 dark:text-surface-300 flex items-center space-x-2"
                >
                    <ListBulletIcon class="w-4 h-4" />
                    <span>查询计划</span>
                </h4>
                <div class="bg-surface-900 rounded-lg p-3 overflow-x-auto">
                    <pre class="text-xs text-green-400 font-mono space-y-1">
<code v-for="(step, index) in executionInfo?.query_plan ?? []" :key="index">{{ formatPlanStep(step) }}</code>
                    </pre>
                </div>
            </div>
        </div>

        <!-- No Result -->
        <div v-else class="text-surface-400 dark:text-surface-500 text-sm">No query executed yet</div>
    </div>
</template>

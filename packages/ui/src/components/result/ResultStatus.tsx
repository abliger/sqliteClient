import { defineComponent, PropType } from 'vue'
import type { QueryResult } from '@types/index'
import { 
  ClockIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'

interface ResultStatusProps {
  isExecuting: boolean
  executionTime?: number
  result?: QueryResult
}

export default defineComponent({
  name: 'ResultStatus',
  props: {
    isExecuting: {
      type: Boolean,
      default: false
    },
    executionTime: {
      type: Number
    },
    result: {
      type: Object as PropType<QueryResult>
    }
  },
  setup(props: ResultStatusProps) {
    const formatDuration = (ms?: number): string => {
      if (ms === undefined) return '-'
      if (ms < 1000) return `${ms}ms`
      return `${(ms / 1000).toFixed(2)}s`
    }

    return () => (
      <div class="h-full p-4 overflow-auto">
        {props.isExecuting && (
          <div class="flex items-center space-x-2 text-primary-600">
            <div class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span>Executing query...</span>
          </div>
        )}

        {!props.isExecuting && props.result && (
          <div class="space-y-4">
            <div class="flex items-center space-x-2 text-green-600">
              <InformationCircleIcon class="w-5 h-5" />
              <span class="font-medium">Query completed successfully</span>
            </div>

            <div class="bg-surface-50 rounded-lg p-4 space-y-2">
              <div class="flex items-center space-x-2 text-surface-600">
                <ClockIcon class="w-4 h-4" />
                <span>Execution time: {formatDuration(props.executionTime)}</span>
              </div>

              {props.result.type === 'rows' && (
                <div class="text-surface-600">
                  Returned {props.result.rows.length} rows
                  {props.result.has_more && ' (truncated)'}
                </div>
              )}

              {props.result.type === 'execution' && (
                <>
                  <div class="text-surface-600">
                    Rows affected: {props.result.rows_affected}
                  </div>
                  {props.result.last_insert_id && (
                    <div class="text-surface-600">
                      Last insert ID: {props.result.last_insert_id}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {!props.isExecuting && !props.result && (
          <div class="text-surface-400 text-sm">
            No query executed yet
          </div>
        )}
      </div>
    )
  }
})

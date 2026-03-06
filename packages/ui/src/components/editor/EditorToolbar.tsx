import { defineComponent, PropType } from 'vue'
import { 
  PlayIcon, 
  PlayCircleIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

export default defineComponent({
  name: 'EditorToolbar',
  props: {
    isExecuting: {
      type: Boolean,
      default: false
    },
    canExecute: {
      type: Boolean,
      default: false
    }
  },
  emits: ['execute', 'executeSelected', 'format'],
  setup(props, { emit }) {
    return () => (
      <div class="flex items-center justify-between px-3 py-2 border-b border-surface-200 bg-surface-50">
        <div class="flex items-center space-x-2">
          {/* 执行按钮 */}
          <button
            class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!props.canExecute || props.isExecuting}
            onClick={() => emit('execute')}
            title="Execute (Ctrl+Enter)"
          >
            <PlayIcon class="w-4 h-4 mr-1.5" />
            {props.isExecuting ? 'Running...' : 'Run'}
          </button>

          <button
            class="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!props.canExecute || props.isExecuting}
            onClick={() => emit('executeSelected')}
            title="Run Selected"
          >
            <PlayCircleIcon class="w-4 h-4 mr-1.5" />
            Run Selected
          </button>

          <div class="w-px h-6 bg-surface-300 mx-2" />

          {/* 格式化 */}
          <button
            class="btn-ghost"
            onClick={() => emit('format')}
            title="Format SQL"
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
    )
  }
})

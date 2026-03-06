import { defineComponent } from 'vue'
import { useQueryStore } from '@stores/query'
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'

export default defineComponent({
  name: 'QueryTabs',
  setup() {
    const queryStore = useQueryStore()

    const handleAddTab = () => {
      queryStore.addTab()
    }

    const handleCloseTab = (tabId: string, event: Event) => {
      event.stopPropagation()
      queryStore.removeTab(tabId)
    }

    return () => (
      <div class="flex items-center bg-surface-100 border-b border-surface-200">
        <div class="flex-1 flex items-center overflow-x-auto scrollbar-thin">
          {queryStore.tabs.map((tab, index) => (
            <div
              key={tab.id}
              class={[
                'group flex items-center space-x-2 px-3 py-2 cursor-pointer transition-colors min-w-[100px] max-w-[150px] border-r border-surface-200',
                queryStore.activeTabId === tab.id
                  ? 'bg-white text-surface-900'
                  : 'hover:bg-surface-200 text-surface-600'
              ]}
              onClick={() => queryStore.setActiveTab(tab.id)}
            >
              <span class="flex-1 text-sm truncate">
                {tab.name}
              </span>
              {tab.isExecuting && (
                <div class="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              )}
              <button
                class={[
                  'p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-300',
                  queryStore.tabs.length === 1 && 'hidden'
                ]}
                onClick={(e) => handleCloseTab(tab.id, e)}
              >
                <XMarkIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          class="p-2 hover:bg-surface-200 text-surface-600"
          onClick={handleAddTab}
          title="New Query Tab"
        >
          <PlusIcon class="w-4 h-4" />
        </button>
      </div>
    )
  }
})

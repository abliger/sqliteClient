<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@stores/connection'
import type { ERDiagram, TableNode, RelationEdge, ColumnNode } from '@types'
import {
  ArrowsPointingOutIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
  KeyIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const connectionStore = useConnectionStore()

// Props
const props = defineProps<{
  diagram: ERDiagram | null
}>()

// Emits
const emit = defineEmits<{
  'refresh': []
}>()

// Canvas state
const canvasRef = ref<SVGSVGElement>()
const containerRef = ref<HTMLDivElement>()
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const isPanning = ref(false)
const dragNode = ref<TableNode | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const lastMousePos = ref({ x: 0, y: 0 })

// Node dimensions
const NODE_WIDTH = 180
const NODE_HEADER_HEIGHT = 32
const NODE_ROW_HEIGHT = 24
const NODE_PADDING = 12

// Calculate node height based on columns
const getNodeHeight = (node: TableNode): number => {
  return NODE_HEADER_HEIGHT + node.columns.length * NODE_ROW_HEIGHT + NODE_PADDING * 2
}

// Get column icon
const getColumnIcon = (column: ColumnNode): string => {
  if (column.is_primary_key) return '🔑'
  if (column.is_foreign_key) return '🔗'
  return ''
}

// Get relation path
const getRelationPath = (relation: RelationEdge): string => {
  const fromNode = props.diagram?.tables.find(t => t.name === relation.from_table)
  const toNode = props.diagram?.tables.find(t => t.name === relation.to_table)
  
  if (!fromNode || !toNode) return ''
  
  const fromX = fromNode.x + NODE_WIDTH
  const fromY = fromNode.y + NODE_HEADER_HEIGHT / 2
  const toX = toNode.x
  const toY = toNode.y + NODE_HEADER_HEIGHT / 2
  
  // Create curved path
  const midX = (fromX + toX) / 2
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
}

// Get relation marker
const getRelationMarker = (relationType: string): string => {
  switch (relationType) {
    case 'onetoone': return 'url(#marker-one)'
    case 'onetomany': return 'url(#marker-many)'
    case 'manytomany': return 'url(#marker-many)'
    default: return ''
  }
}

// Transform style for canvas
const canvasTransform = computed(() => {
  return `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`
})

// Mouse event handlers
const handleMouseDown = (e: MouseEvent, node?: TableNode) => {
  if (node) {
    // Start dragging node
    isDragging.value = true
    dragNode.value = node
    dragOffset.value = {
      x: e.clientX / scale.value - node.x,
      y: e.clientY / scale.value - node.y
    }
  } else {
    // Start panning
    isPanning.value = true
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value && dragNode.value) {
    dragNode.value.x = e.clientX / scale.value - dragOffset.value.x - panX.value / scale.value
    dragNode.value.y = e.clientY / scale.value - dragOffset.value.y - panY.value / scale.value
  } else if (isPanning.value) {
    const dx = e.clientX - lastMousePos.value.x
    const dy = e.clientY - lastMousePos.value.y
    panX.value += dx
    panY.value += dy
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  isPanning.value = false
  dragNode.value = null
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.3, Math.min(3, scale.value * delta))
  scale.value = newScale
}

// Zoom controls
const zoomIn = () => {
  scale.value = Math.min(3, scale.value * 1.2)
}

const zoomOut = () => {
  scale.value = Math.max(0.3, scale.value / 1.2)
}

const resetView = () => {
  scale.value = 1
  panX.value = 0
  panY.value = 0
  autoLayout()
}

// Auto layout using simple grid algorithm
const autoLayout = () => {
  if (!props.diagram) return
  
  const tables = props.diagram.tables
  const cols = Math.ceil(Math.sqrt(tables.length))
  const spacingX = 250
  const spacingY = 200
  
  tables.forEach((table, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    table.x = col * spacingX + 50
    table.y = row * spacingY + 50
  })
}

// Initialize layout when diagram changes
watch(() => props.diagram, (newDiagram) => {
  if (newDiagram && newDiagram.tables.length > 0) {
    // Check if positions are already set
    const hasPositions = newDiagram.tables.some(t => t.x !== 0 || t.y !== 0)
    if (!hasPositions) {
      autoLayout()
    }
  }
}, { immediate: true })

// Global mouse events
onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div ref="containerRef" class="h-full w-full relative bg-surface-50 dark:bg-surface-900 overflow-hidden">
    <!-- Toolbar -->
    <div class="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
      <div class="flex items-center space-x-2 bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-200 dark:border-surface-700 px-2 py-1">
        <button
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
          :title="t('erDiagram.zoomIn')"
          @click="zoomIn"
        >
          <MagnifyingGlassPlusIcon class="w-4 h-4" />
        </button>
        <span class="text-xs text-surface-500 dark:text-surface-400 min-w-[50px] text-center">
          {{ Math.round(scale * 100) }}%
        </span>
        <button
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
          :title="t('erDiagram.zoomOut')"
          @click="zoomOut"
        >
          <MagnifyingGlassMinusIcon class="w-4 h-4" />
        </button>
        <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-1" />
        <button
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
          :title="t('erDiagram.resetView')"
          @click="resetView"
        >
          <ArrowsPointingOutIcon class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
          :title="t('erDiagram.refresh')"
          @click="emit('refresh')"
        >
          <ArrowPathIcon class="w-4 h-4" />
        </button>
      </div>
      
      <!-- Legend -->
      <div class="flex items-center space-x-4 bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs">
        <div class="flex items-center space-x-1">
          <KeyIcon class="w-3.5 h-3.5 text-amber-500" />
          <span class="text-surface-600 dark:text-surface-400">{{ t('erDiagram.primaryKey') }}</span>
        </div>
        <div class="flex items-center space-x-1">
          <LinkIcon class="w-3.5 h-3.5 text-blue-500" />
          <span class="text-surface-600 dark:text-surface-400">{{ t('erDiagram.foreignKey') }}</span>
        </div>
      </div>
    </div>

    <!-- Canvas -->
    <div
      class="h-full w-full cursor-grab"
      :class="{ 'cursor-grabbing': isPanning }"
      @mousedown="(e) => handleMouseDown(e)"
      @wheel="handleWheel"
    >
      <svg
        ref="canvasRef"
        class="h-full w-full"
        :style="{ transform: canvasTransform, transformOrigin: '0 0' }"
      >
        <!-- Definitions for markers -->
        <defs>
          <!-- One marker -->
          <marker
            id="marker-one"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
          <!-- Many marker -->
          <marker
            id="marker-many"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
            <text x="5" y="8" font-size="8" fill="#94a3b8">*</text>
          </marker>
        </defs>

        <!-- Relations -->
        <g v-if="diagram">
          <path
            v-for="relation in diagram.relations"
            :key="relation.id"
            :d="getRelationPath(relation)"
            fill="none"
            stroke="#94a3b8"
            stroke-width="1.5"
            :marker-end="getRelationMarker(relation.relation_type)"
            class="dark:stroke-surface-500"
          />
        </g>

        <!-- Table Nodes -->
        <g v-if="diagram">
          <g
            v-for="node in diagram.tables"
            :key="node.id"
            :transform="`translate(${node.x}, ${node.y})`"
            class="cursor-move"
            @mousedown.stop="(e) => handleMouseDown(e, node)"
          >
            <!-- Node Background -->
            <rect
              :width="NODE_WIDTH"
              :height="getNodeHeight(node)"
              rx="6"
              ry="6"
              fill="white"
              stroke="#e2e8f0"
              stroke-width="1.5"
              class="dark:fill-surface-800 dark:stroke-surface-600"
              filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))"
            />

            <!-- Header -->
            <rect
              :width="NODE_WIDTH"
              :height="NODE_HEADER_HEIGHT"
              rx="6"
              ry="6"
              fill="#f1f5f9"
              class="dark:fill-surface-700"
            />
            <rect
              :width="NODE_WIDTH"
              :height="NODE_HEADER_HEIGHT - 6"
              y="6"
              fill="#f1f5f9"
              class="dark:fill-surface-700"
            />

            <!-- Table Name -->
            <text
              x="12"
              y="21"
              font-size="12"
              font-weight="600"
              fill="#334155"
              class="dark:fill-surface-200"
            >
              {{ node.name }}
            </text>

            <!-- Columns -->
            <g :transform="`translate(0, ${NODE_HEADER_HEIGHT})`">
              <g
                v-for="(column, index) in node.columns"
                :key="column.name"
                :transform="`translate(0, ${index * NODE_ROW_HEIGHT})`"
              >
                <!-- Column Row -->
                <rect
                  :width="NODE_WIDTH"
                  :height="NODE_ROW_HEIGHT"
                  fill="transparent"
                />
                
                <!-- PK/FK Icon -->
                <text
                  x="8"
                  y="16"
                  font-size="10"
                >
                  {{ getColumnIcon(column) }}
                </text>

                <!-- Column Name -->
                <text
                  x="24"
                  y="16"
                  font-size="11"
                  :fill="column.is_primary_key ? '#d97706' : column.is_foreign_key ? '#3b82f6' : '#64748b'"
                  :font-weight="column.is_primary_key ? '600' : '400'"
                  class="dark:fill-surface-300"
                >
                  {{ column.name }}
                </text>

                <!-- Data Type -->
                <text
                  x="NODE_WIDTH - 8"
                  y="16"
                  font-size="10"
                  fill="#94a3b8"
                  text-anchor="end"
                  class="dark:fill-surface-500"
                >
                  {{ column.data_type }}
                </text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <!-- Empty State -->
    <div
      v-if="!diagram || diagram.tables.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center text-surface-400 dark:text-surface-500"
    >
      <svg class="w-16 h-16 mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <path d="M10 6h4M6 10v4m12 0v4" stroke-dasharray="2 2" />
      </svg>
      <p class="text-sm">{{ t('erDiagram.noTables') }}</p>
      <p v-if="connectionStore.activeConnection" class="text-xs mt-1 opacity-70">
        {{ t('erDiagram.clickRefresh') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
svg {
  transition: transform 0.1s ease-out;
}

svg text {
  user-select: none;
}

/* Custom scrollbar for dark mode */
:deep(.dark) ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

:deep(.dark) ::-webkit-scrollbar-track {
  background: #1e293b;
}

:deep(.dark) ::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

:deep(.dark) ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>

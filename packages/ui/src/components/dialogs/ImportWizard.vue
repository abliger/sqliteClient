<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImportStore } from '@stores/import'
import { useConnectionStore } from '@stores/connection'
import { useToastStore } from '@stores/toast'
import { importService, SQLITE_DATA_TYPES } from '@services/import'
import { usePlatformAsync } from '@services/platform'
import { 
  DocumentArrowUpIcon,
  TableCellsIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const importStore = useImportStore()
const connectionStore = useConnectionStore()
const toastStore = useToastStore()



const isTableNameValid = ref(true)
const isCheckingTableName = ref(false)

// 支持的文件类型
const supportedFormats = [
  { extension: 'csv', name: 'CSV', accept: '.csv' },
  { extension: 'xlsx', name: 'Excel', accept: '.xlsx,.xls' }
]

// 选择文件
const { platform } = usePlatformAsync()

const handleSelectFile = async () => {
  if (!platform.value || platform.value.capabilities.fileSystem === 'none') {
    toastStore.error('Not available', 'File dialog is only available in the desktop app or VSCode')
    return
  }
  
  const selected = await platform.value.fs.showOpenDialog({
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'Excel', extensions: ['xlsx', 'xls'] }
    ]
  })
  
  if (selected) {
    const path = selected
    const fileName = path.split(/[/\\]/).pop() || ''
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    
    importStore.setFile(path, extension, fileName)
    await importStore.parseFile()
    
    if (importStore.preview) {
      importStore.nextStep()
    }
  }
}

// 验证表名
const checkTableName = async () => {
  if (!connectionStore.activeConnectionId || !importStore.config.table_name) return
  
  isCheckingTableName.value = true
  try {
    const exists = await importService.validateTableName(
      connectionStore.activeConnectionId,
      importStore.config.table_name
    )
    isTableNameValid.value = !exists || importStore.config.overwrite_existing
  } catch {
    isTableNameValid.value = true
  } finally {
    isCheckingTableName.value = false
  }
}

// 监听表名变化
watch(() => importStore.config.table_name, () => {
  checkTableName()
})

watch(() => importStore.config.overwrite_existing, () => {
  checkTableName()
})

// 执行导入
const handleImport = async () => {
  if (!connectionStore.activeConnectionId) return
  
  const result = await importStore.executeImport(connectionStore.activeConnectionId)
  if (result) {
    // 导入成功，可以在这里刷新表列表
  }
}

// 关闭并重置
const handleClose = () => {
  importStore.closeWizard()
}

// 获取数据类型标签
const getDataTypeLabel = (type: string) => {
  const found = SQLITE_DATA_TYPES.find(t => t.value === type)
  return found?.label || type
}


</script>

<template>
  <div 
    v-if="importStore.isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="handleClose"
  >
    <div class="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-surface-800 rounded-lg shadow-xl flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
        <div class="flex items-center space-x-3">
          <DocumentArrowUpIcon class="w-6 h-6 text-primary-500" />
          <h2 class="text-lg font-semibold text-surface-800 dark:text-surface-200">
            {{ t('import.title') }}
          </h2>
        </div>
        <div class="flex items-center space-x-4">
          <!-- 进度指示器 -->
          <div class="flex items-center space-x-2 text-sm text-surface-500">
            <span 
              class="px-2 py-0.5 rounded-full"
              :class="{
                'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': importStore.currentStep === 'file',
                'bg-surface-100 dark:bg-surface-700 text-surface-500': importStore.currentStep !== 'file'
              }"
            >
              1
            </span>
            <span class="text-surface-300">→</span>
            <span 
              class="px-2 py-0.5 rounded-full"
              :class="{
                'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': importStore.currentStep === 'mapping',
                'bg-surface-100 dark:bg-surface-700 text-surface-500': importStore.currentStep !== 'mapping'
              }"
            >
              2
            </span>
            <span class="text-surface-300">→</span>
            <span 
              class="px-2 py-0.5 rounded-full"
              :class="{
                'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': importStore.currentStep === 'preview' || importStore.currentStep === 'importing',
                'bg-surface-100 dark:bg-surface-700 text-surface-500': importStore.currentStep !== 'preview' && importStore.currentStep !== 'importing'
              }"
            >
              3
            </span>
          </div>
          <button 
            class="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
            @click="handleClose"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- 步骤 1: 选择文件 -->
        <div v-if="importStore.currentStep === 'file'" class="space-y-6">
          <div class="text-center py-12">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <DocumentArrowUpIcon class="w-10 h-10 text-primary-500" />
            </div>
            <h3 class="text-lg font-medium text-surface-800 dark:text-surface-200 mb-2">
              {{ t('import.selectFile') }}
            </h3>
            <p class="text-sm text-surface-500 dark:text-surface-400 mb-6 max-w-md mx-auto">
              {{ t('import.selectFileHint') }}
            </p>
            <button class="btn-primary" @click="handleSelectFile">
              <DocumentArrowUpIcon class="w-4 h-4 mr-2" />
              {{ t('import.browseFile') }}
            </button>
            
            <!-- 支持的格式 -->
            <div class="mt-8 flex justify-center space-x-4">
              <div 
                v-for="format in supportedFormats" 
                :key="format.extension"
                class="px-3 py-2 bg-surface-100 dark:bg-surface-700 rounded-lg text-sm text-surface-600 dark:text-surface-400"
              >
                .{{ format.extension }}
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤 2: 字段映射 -->
        <div v-if="importStore.currentStep === 'mapping'" class="space-y-6">
          <!-- 文件信息 -->
          <div class="flex items-center space-x-4 p-4 bg-surface-50 dark:bg-surface-900/50 rounded-lg">
            <DocumentArrowUpIcon class="w-8 h-8 text-primary-500" />
            <div>
              <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
                {{ importStore.fileName }}
              </p>
              <p class="text-xs text-surface-500">
                {{ importStore.preview?.total_rows }} {{ t('import.rowsTotal') }}
              </p>
            </div>
            <button class="btn-ghost text-xs ml-auto" @click="importStore.goToStep('file')">
              {{ t('import.changeFile') }}
            </button>
          </div>

          <!-- 表名设置 -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                {{ t('import.tableName') }}
              </label>
              <div class="relative">
                <TableCellsIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  v-model="importStore.config.table_name"
                  type="text"
                  class="input pl-9"
                  :class="{ 'border-red-500': !isTableNameValid }"
                  :placeholder="t('import.tableNamePlaceholder')"
                />
                <div v-if="isCheckingTableName" class="absolute right-3 top-1/2 -translate-y-1/2">
                  <ArrowPathIcon class="w-4 h-4 text-surface-400 animate-spin" />
                </div>
              </div>
              <p v-if="!isTableNameValid" class="mt-1 text-xs text-red-500">
                {{ t('import.tableExists') }}
              </p>
            </div>
            <div class="flex items-end">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  v-model="importStore.config.overwrite_existing"
                  type="checkbox"
                  class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm text-surface-700 dark:text-surface-300">
                  {{ t('import.overwriteExisting') }}
                </span>
              </label>
            </div>
          </div>

          <!-- 列映射表格 -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300">
                {{ t('import.columnMapping') }}
              </h4>
              <p class="text-xs text-surface-500">
                {{ importStore.config.column_mappings.length }} {{ t('import.columnsCount') }}
              </p>
            </div>
            
            <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-surface-50 dark:bg-surface-900/50">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-surface-500">
                      {{ t('import.sourceColumn') }}
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-surface-500">
                      {{ t('import.targetColumn') }}
                    </th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-surface-500">
                      {{ t('import.dataType') }}
                    </th>
                    <th class="px-3 py-2 text-center text-xs font-medium text-surface-500">
                      {{ t('import.primaryKey') }}
                    </th>
                    <th class="px-3 py-2 text-center text-xs font-medium text-surface-500">
                      {{ t('import.nullable') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-200 dark:divide-surface-700">
                  <tr 
                    v-for="(mapping, index) in importStore.config.column_mappings" 
                    :key="mapping.source_column"
                    class="hover:bg-surface-50 dark:hover:bg-surface-800/50"
                  >
                    <td class="px-3 py-2 text-surface-700 dark:text-surface-300">
                      {{ mapping.source_column }}
                    </td>
                    <td class="px-3 py-2">
                      <input
                        v-model="mapping.target_column"
                        type="text"
                        class="input py-1 text-xs"
                      />
                    </td>
                    <td class="px-3 py-2">
                      <select
                        v-model="mapping.data_type"
                        class="input py-1 text-xs"
                      >
                        <option 
                          v-for="type in SQLITE_DATA_TYPES" 
                          :key="type.value" 
                          :value="type.value"
                        >
                          {{ type.label }}
                        </option>
                      </select>
                    </td>
                    <td class="px-3 py-2 text-center">
                      <input
                        v-model="mapping.is_primary_key"
                        type="checkbox"
                        class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        @change="(e) => importStore.updateColumnMapping(index, { is_primary_key: (e.target as HTMLInputElement).checked })"
                      />
                    </td>
                    <td class="px-3 py-2 text-center">
                      <input
                        v-model="mapping.nullable"
                        type="checkbox"
                        class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        @change="(e) => importStore.updateColumnMapping(index, { nullable: (e.target as HTMLInputElement).checked })"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 步骤 3: 预览和导入 -->
        <div v-if="importStore.currentStep === 'preview' || importStore.currentStep === 'importing'" class="space-y-6">
          <!-- 导入结果 -->
          <div v-if="importStore.result" class="p-4 rounded-lg" :class="importStore.result.failed_rows === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'">
            <div class="flex items-start space-x-3">
              <CheckCircleIcon 
                class="w-5 h-5" 
                :class="importStore.result.failed_rows === 0 ? 'text-green-500' : 'text-yellow-500'"
              />
              <div>
                <h4 class="text-sm font-medium" :class="importStore.result.failed_rows === 0 ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'">
                  {{ importStore.result.failed_rows === 0 ? t('import.importSuccess') : t('import.importPartial') }}
                </h4>
                <p class="text-xs mt-1" :class="importStore.result.failed_rows === 0 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
                  {{ t('import.importedRows') }}: {{ importStore.result.imported_rows }}
                  <span v-if="importStore.result.failed_rows > 0">
                    , {{ t('import.failedRows') }}: {{ importStore.result.failed_rows }}
                  </span>
                  ({{ importStore.result.duration_ms }}ms)
                </p>
                <div v-if="importStore.result.errors.length > 0" class="mt-2 text-xs space-y-1">
                  <p v-for="(err, i) in importStore.result.errors" :key="i" class="text-red-600">
                    {{ err }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 数据预览 -->
          <div v-if="importStore.preview && !importStore.result">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300">
                {{ t('import.dataPreview') }}
              </h4>
              <p class="text-xs text-surface-500">
                {{ t('import.showingFirst') }} {{ importStore.preview.rows.length }} {{ t('import.rows') }}
              </p>
            </div>
            
            <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-auto max-h-64">
              <table class="w-full text-sm">
                <thead class="bg-surface-50 dark:bg-surface-900/50 sticky top-0">
                  <tr>
                    <th 
                      v-for="col in importStore.preview.columns" 
                      :key="col"
                      class="px-3 py-2 text-left text-xs font-medium text-surface-500 whitespace-nowrap"
                    >
                      {{ col }}
                      <span class="text-surface-400 font-normal">
                        ({{ getDataTypeLabel(importStore.config.column_mappings.find(m => m.source_column === col)?.data_type || 'TEXT') }})
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-200 dark:divide-surface-700">
                  <tr 
                    v-for="(row, idx) in importStore.preview.rows.slice(0, 10)" 
                    :key="idx"
                    class="hover:bg-surface-50 dark:hover:bg-surface-800/50"
                  >
                    <td 
                      v-for="col in importStore.preview.columns" 
                      :key="col"
                      class="px-3 py-2 text-surface-700 dark:text-surface-300 truncate max-w-xs"
                      :title="row[col]"
                    >
                      {{ row[col] || 'NULL' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 导入中状态 -->
          <div v-if="importStore.isLoading && importStore.currentStep === 'importing'" class="text-center py-8">
            <ArrowPathIcon class="w-8 h-8 mx-auto text-primary-500 animate-spin mb-3" />
            <p class="text-sm text-surface-600 dark:text-surface-400">
              {{ t('import.importing') }}...
            </p>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="importStore.error" class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div class="flex items-start space-x-3">
            <ExclamationCircleIcon class="w-5 h-5 text-red-500 flex-shrink-0" />
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ importStore.error }}
            </p>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-between px-6 py-4 border-t border-surface-200 dark:border-surface-700">
        <button
          v-if="importStore.currentStep !== 'file' && importStore.currentStep !== 'importing'"
          class="btn-ghost"
          :disabled="importStore.isLoading"
          @click="importStore.previousStep"
        >
          <ArrowLeftIcon class="w-4 h-4 mr-2" />
          {{ t('common.back') }}
        </button>
        <div v-else></div>

        <div class="flex items-center space-x-3">
          <button
            v-if="importStore.result"
            class="btn-primary"
            @click="handleClose"
          >
            <CheckCircleIcon class="w-4 h-4 mr-2" />
            {{ t('common.close') }}
          </button>
          <template v-else>
            <button
              class="btn-ghost"
              @click="handleClose"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              v-if="importStore.currentStep === 'mapping'"
              class="btn-primary"
              :disabled="!importStore.canProceed || !isTableNameValid"
              @click="importStore.nextStep"
            >
              {{ t('import.preview') }}
              <ArrowRightIcon class="w-4 h-4 ml-2" />
            </button>
            <button
              v-if="importStore.currentStep === 'preview'"
              class="btn-primary"
              :disabled="!importStore.canProceed || importStore.isLoading"
              @click="handleImport"
            >
              <DocumentArrowUpIcon class="w-4 h-4 mr-2" />
              {{ t('import.startImport') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

export default {
  // Common
  common: {
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    close: '关闭',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    search: '搜索',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    empty: '暂无数据',
  },

  // Connection
  connection: {
    title: '连接',
    openDatabase: '打开数据库',
    newDatabase: '新建数据库',
    openDatabaseTip: '打开已有的 SQLite 数据库',
    newDatabaseTip: '创建新的 SQLite 数据库',
    noConnections: '暂无连接。点击文件夹图标打开数据库。',
    closeConnection: '关闭连接',
    databaseInfo: '数据库信息',
    version: '版本',
    tables: '表',
    size: '大小',
    // Toast messages
    openSuccess: '数据库已打开',
    openError: '打开数据库失败',
    createSuccess: '数据库已创建',
    createError: '创建数据库失败',
    closeSuccess: '连接已关闭',
    closeError: '关闭连接失败',
    selectFolderError: '选择文件夹失败',
  },

  // New Database Dialog
  newDatabase: {
    location: '保存位置',
    noLocation: '未选择文件夹',
    name: '数据库名称',
    namePlaceholder: '请输入数据库名称',
    nameHint: '将自动添加 .db 扩展名',
    fullPath: '完整路径',
    create: '创建数据库',
  },

  // Database Tree
  databaseTree: {
    tables: '表',
    erDiagram: 'ER 图',
    noConnection: '打开数据库以查看表',
    noTables: '未找到表',
    selectQuery: 'SELECT',
    insertQuery: 'INSERT',
    primaryKey: '主键',
    foreignKey: '外键',
  },

  // Query Editor
  editor: {
    title: '查询编辑器',
    run: '运行',
    runSelected: '运行选中',
    format: '格式化',
    running: '运行中...',
    execute: '执行 (Ctrl+Enter)',
    runSelectedQuery: '运行选中语句',
    formatSQL: '格式化 SQL',
    newQueryTab: '新建查询标签',
    shortcutHint: 'Ctrl+Enter 运行',
    commentShortcut: 'Ctrl+/ 注释',
    noConnection: '请先打开数据库连接',
    closeTab: '关闭标签',
    closeTabsToRight: '关闭右侧标签',
    closeOtherTabs: '关闭其他标签',
  },

  // Results
  results: {
    title: '结果',
    messages: '消息',
    rowsAffected: '行受影响',
    executionTime: '执行时间',
    noResults: '暂无结果显示',
    exportCSV: '导出 CSV',
    exportJSON: '导出 JSON',
    exportSuccess: '导出成功',
    exportError: '导出失败',
    executeHint: '执行查询以查看结果',
    shortcutHint: '按 Ctrl+Enter 运行',
    executionSuccess: '查询执行成功',
    lastInsertId: '最后插入 ID',
  },

  // Settings
  settings: {
    title: '设置',
    language: '语言',
    languageTip: '选择界面语言',
    theme: '主题',
    auto: '自动',
    light: '浅色',
    dark: '深色',
  },

  // Errors
  errors: {
    connectionFailed: '连接数据库失败',
    queryFailed: '查询执行失败',
    exportFailed: '导出失败',
  },
}

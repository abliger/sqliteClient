export default {
  // Common
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    empty: 'No data',
  },

  // Connection
  connection: {
    title: 'Connection',
    openDatabase: 'Open Database',
    newDatabase: 'New Database',
    openDatabaseTip: 'Open existing SQLite database',
    newDatabaseTip: 'Create a new SQLite database',
    noConnections: 'No connections. Click the folder icon to open a database.',
    closeConnection: 'Close Connection',
    databaseInfo: 'Database Info',
    version: 'Version',
    tables: 'Tables',
    size: 'Size',
    // Toast messages
    openSuccess: 'Database Opened',
    openError: 'Failed to Open Database',
    createSuccess: 'Database Created',
    createError: 'Failed to Create Database',
    closeSuccess: 'Connection Closed',
    closeError: 'Failed to Close Connection',
    selectFolderError: 'Failed to Select Folder',
  },

  // New Database Dialog
  newDatabase: {
    location: 'Save Location',
    noLocation: 'No folder selected',
    name: 'Database Name',
    namePlaceholder: 'Enter database name',
    nameHint: 'The .db extension will be added automatically',
    fullPath: 'Full Path',
    create: 'Create Database',
  },

  // Database Tree
  databaseTree: {
    tables: 'Tables',
    erDiagram: 'ER Diagram',
    noConnection: 'Open a database to view tables',
    noTables: 'No tables found',
    selectQuery: 'SELECT',
    insertQuery: 'INSERT',
    primaryKey: 'Primary Key',
    foreignKey: 'Foreign Key',
  },

  // Query Editor
  editor: {
    title: 'Query Editor',
    run: 'Run',
    runSelected: 'Run Selected',
    format: 'Format',
    running: 'Running...',
    execute: 'Execute (Ctrl+Enter)',
    runSelectedQuery: 'Run Selected',
    formatSQL: 'Format SQL',
    newQueryTab: 'New Query Tab',
    shortcutHint: 'Ctrl+Enter to run',
    commentShortcut: 'Ctrl+/ to comment',
    noConnection: 'Please open a database connection',
    closeTab: 'Close Tab',
    closeTabsToRight: 'Close Tabs to Right',
    closeOtherTabs: 'Close Other Tabs',
  },

  // Results
  results: {
    title: 'Results',
    messages: 'Messages',
    rowsAffected: 'rows affected',
    executionTime: 'Execution time',
    noResults: 'No results to display',
    exportCSV: 'Export CSV',
    exportJSON: 'Export JSON',
    exportSuccess: 'Export Successful',
    exportError: 'Export Failed',
    executeHint: 'Execute a query to see results',
    shortcutHint: 'Press Ctrl+Enter to run',
    executionSuccess: 'Query executed successfully',
    lastInsertId: 'Last insert ID',
    // Row editing
    editRow: 'Edit Row',
    table: 'Table',
    default: 'Default',
    confirmDelete: 'Are you sure you want to delete this row?',
    delete: 'Delete',
    noTableName: 'Cannot determine table name from query',
    updateSuccess: 'Row updated successfully',
    updateError: 'Failed to update row',
    deleteSuccess: 'Row deleted successfully',
    deleteError: 'Failed to delete row',
  },

  // Settings
  settings: {
    title: 'Settings',
    language: 'Language',
    languageTip: 'Select interface language',
    theme: 'Theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
  },

  // Errors
  errors: {
    connectionFailed: 'Failed to connect to database',
    queryFailed: 'Query execution failed',
    exportFailed: 'Export failed',
  },
}

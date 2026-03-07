# SQLite Client for VSCode

VSCode extension for managing SQLite databases, sharing the same UI components as the desktop app.

## Features

- Connect to SQLite databases
- Browse database schema (tables, indexes, triggers)
- Execute SQL queries with syntax highlighting
- View and edit table data
- Visual ER diagram
- Query history
- Export query results to CSV/JSON
- Import data from CSV/Excel

## Prerequisites

- VSCode 1.85.0 or higher
- Node.js 18+ and pnpm

## Installation

### Build from source

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm build

# Package the extension (optional)
pnpm package
```

### Install in VSCode

1. Open VSCode
2. Go to Extensions view (Ctrl+Shift+X)
3. Click "..." menu and select "Install from VSIX"
4. Select the generated `.vsix` file from `packages/vscode/`

## Usage

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `SQLite Client: Open SQLite Database`
3. Select a `.db`, `.sqlite`, or `.sqlite3` file

Or right-click on a database file in the Explorer and select `Open SQLite Database`.

## Development

### Project Structure

```
packages/vscode/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── database.ts           # SQLite database service (replaces Tauri backend)
│   ├── webview-panel.ts      # Webview panel management
│   ├── types.ts              # Type definitions
│   └── webview-ui/           # Webview frontend
│       ├── main.ts           # Vue app entry
│       ├── App.vue           # Root component
│       ├── vscode-api.ts     # VSCode API adapter
│       └── mocks/            # Tauri API mocks
├── package.json              # Extension manifest
└── vite.config.ts            # Build configuration
```

### How it works

The VSCode extension reuses the UI components from `packages/ui` by:

1. Mocking Tauri API calls to use VSCode's message passing instead
2. Implementing a SQLite backend using `better-sqlite3` instead of Rust/Tauri
3. Rendering the UI in a VSCode Webview panel

### Build Commands

```bash
# Build extension backend
pnpm build:extension

# Build webview frontend
pnpm build:webview

# Build both
pnpm build

# Watch mode for development
pnpm dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VSCode Extension                      │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │  Extension Host │──────│  DatabaseManager        │  │
│  │  (Node.js)      │      │  (better-sqlite3)       │  │
│  └─────────────────┘      └─────────────────────────┘  │
│           │                                              │
│           │ postMessage                                  │
│           ▼                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Webview Panel                        │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │  Vue3 App (reused from packages/ui)         │ │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌───────────┐   │ │   │
│  │  │  │ Stores  │  │Components│  │ Composables│   │ │   │
│  │  │  └─────────┘  └─────────┘  └───────────┘   │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## License

MIT

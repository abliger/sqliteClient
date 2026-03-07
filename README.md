# SQLite Client

A modern, cross-platform SQLite client built with Tauri and Vue3. Available as both a desktop application and a VSCode extension.

## Features

- **Multi-Connection Management**: Open multiple SQLite databases simultaneously with tabbed interface
- **Advanced SQL Editor**: Monaco Editor with syntax highlighting, auto-completion, and formatting
- **Visual Schema Explorer**: Browse tables, columns, indexes, and triggers
- **ER Diagram Visualization**: Visual representation of table relationships
- **Data Editing**: Inline editing and form-based CRUD operations
- **Query History**: Global search and management of executed queries
- **Export Capabilities**: Export query results to CSV and JSON formats
- **Stream Processing**: Handle large datasets with streaming query results

## Platforms

- **Desktop App**: Cross-platform desktop application built with Tauri
- **VSCode Extension**: Use SQLite Client directly within VSCode

## Tech Stack

### Backend

- **Tauri v2** - Cross-platform desktop framework (Desktop app)
- **better-sqlite3** - SQLite driver for Node.js (VSCode extension)
- **Rust** - Systems programming language
- **rusqlite** - SQLite driver for Rust
- **r2d2** - Connection pooling

### Frontend

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **TSX** - TypeScript XML for components
- **TailwindCSS** - Utility-first CSS framework
- **Monaco Editor** - VS Code's editor component
- **Pinia** - State management
- **ECharts** - Charting library for ER diagrams

## Project Structure

```
sqlite-client/
├── apps/
│   └── desktop/              # Tauri desktop application
│       └── src-tauri/        # Rust backend code
├── packages/
│   ├── ui/                   # Vue3 frontend application (shared)
│   │   ├── src/
│   │   │   ├── components/   # Vue components
│   │   │   ├── stores/       # Pinia stores
│   │   │   ├── services/     # Tauri API wrappers
│   │   │   └── types/        # TypeScript types
│   │   └── package.json
│   └── vscode/               # VSCode extension
│       ├── src/
│       │   ├── extension.ts  # Extension entry
│       │   ├── database.ts   # SQLite backend
│       │   └── webview-ui/   # Webview frontend
│       └── package.json
├── Cargo.toml                # Rust workspace configuration
├── package.json              # Node.js workspace configuration
└── turbo.json                # Turborepo configuration
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (1.75+) - For desktop app
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/) (8+)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd sqlite-client

# Install dependencies
pnpm install

# Install Tauri CLI (for desktop app)
cargo install tauri-cli
```

### Desktop App

```bash
# Run the desktop app in development mode
pnpm desktop:dev

# Build for production
pnpm desktop:build
```

### VSCode Extension

```bash
# Build the extension
cd packages/vscode
pnpm build

# Package the extension
pnpm package

# Install in VSCode
# 1. Open VSCode
# 2. Go to Extensions view (Ctrl+Shift+X)
# 3. Click "..." menu and select "Install from VSIX"
# 4. Select packages/vscode/sqlite-client-0.1.0.vsix
```

## Usage

### Desktop App

Launch the app and use the "Open Database" button to connect to a SQLite database.

### VSCode Extension

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `SQLite Client: Open SQLite Database`
3. Select a `.db`, `.sqlite`, or `.sqlite3` file

Or right-click on a database file in the Explorer and select `Open SQLite Database`.

## Architecture

### Desktop App

```
┌─────────────────────────────────────────────────────────┐
│                   Tauri Application                      │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │  Rust Backend   │──────│  SQLite (rusqlite)      │  │
│  │  (Tauri)        │      │  Connection Pool        │  │
│  └─────────────────┘      └─────────────────────────┘  │
│           │                                              │
│           │ Tauri Commands                               │
│           ▼                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              WebView (WebKit/Edge)                │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │  Vue3 Frontend                              │ │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌───────────┐   │ │   │
│  │  │  │ Stores  │  │Components│  │ Composables│   │ │   │
│  │  │  └─────────┘  └─────────┘  └───────────┘   │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### VSCode Extension

```
┌─────────────────────────────────────────────────────────┐
│                    VSCode Extension                      │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │  Extension Host │──────│  DatabaseManager        │  │
│  │  (Node.js)      │      │  (better-sqlite3)       │  │
│  └─────────────────┘      └─────────────────────────┘  │
│           │                                              │
│           │ VSCode Message API                           │
│           ▼                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Webview Panel                        │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │  Vue3 App (same UI as desktop)              │ │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌───────────┐   │ │   │
│  │  │  │ Stores  │  │Components│  │ Composables│   │ │   │
│  │  │  └─────────┘  └─────────┘  └───────────┘   │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The VSCode extension reuses the same UI components from `packages/ui` by:

1. Mocking Tauri API calls to use VSCode's message passing instead
2. Implementing a SQLite backend using `better-sqlite3` instead of Rust/Tauri
3. Rendering the UI in a VSCode Webview panel

## Keyboard Shortcuts

| Shortcut     | Action          |
| ------------ | --------------- |
| `Ctrl+Enter` | Execute query   |
| `Ctrl+/`     | Toggle comment  |
| `Ctrl+N`     | New query tab   |
| `Ctrl+W`     | Close query tab |
| `Ctrl+O`     | Open database   |

## License

MIT

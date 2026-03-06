# SQLite Client

A modern, cross-platform SQLite client built with Tauri and Vue3.

## Features

- **Multi-Connection Management**: Open multiple SQLite databases simultaneously with tabbed interface
- **Advanced SQL Editor**: Monaco Editor with syntax highlighting, auto-completion, and formatting
- **Visual Schema Explorer**: Browse tables, columns, indexes, and triggers
- **ER Diagram Visualization**: Visual representation of table relationships
- **Data Editing**: Inline editing and form-based CRUD operations
- **Query History**: Global search and management of executed queries
- **Export Capabilities**: Export query results to CSV and JSON formats
- **Stream Processing**: Handle large datasets with streaming query results

## Tech Stack

### Backend
- **Tauri v2** - Cross-platform desktop framework
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
│   ├── ui/                   # Vue3 frontend application
│   │   ├── src/
│   │   │   ├── components/   # Vue components
│   │   │   ├── stores/       # Pinia stores
│   │   │   ├── services/     # Tauri API wrappers
│   │   │   └── types/        # TypeScript types
│   │   └── package.json
│   └── shared/               # Shared types (Rust)
├── Cargo.toml                # Rust workspace configuration
├── package.json              # Node.js workspace configuration
└── turbo.json                # Turborepo configuration
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (1.75+)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/) (8+)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd sqlite-client

# Install dependencies
pnpm install

# Install Tauri CLI
cargo install tauri-cli
```

### Development Mode

```bash
# Run the desktop app in development mode
pnpm desktop:dev
```

### Build

```bash
# Build for production
pnpm desktop:build
```

## Architecture

### Backend (Rust)

- **Connection Manager**: Manages multiple database connections with connection pooling
- **Query Engine**: Executes SQL queries with streaming support for large datasets
- **Schema Analyzer**: Extracts database metadata and generates ER diagrams
- **History Store**: Persists query history using SQLite with FTS5 for search

### Frontend (Vue3)

- **Connection Store**: Manages active connections and their state
- **Query Store**: Manages query tabs, execution state, and results
- **Schema Store**: Caches and manages database schema information
- **History Store**: Manages query history and search

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Execute query |
| `Ctrl+/` | Toggle comment |
| `Ctrl+N` | New query tab |
| `Ctrl+W` | Close query tab |
| `Ctrl+O` | Open database |

## License

MIT

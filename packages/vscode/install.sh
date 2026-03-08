#!/bin/bash
# SQLite Client VSCode Extension Installer

set -e

VSIX_FILE="sqlite-client-0.1.0.vsix"

echo "🔧 SQLite Client VSCode Extension Installer"
echo "=========================================="

# 检查文件是否存在
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Error: $VSIX_FILE not found!"
    echo "Please run 'pnpm build' first."
    exit 1
fi

# 检查 code 命令
if ! command -v code &> /dev/null; then
    echo "❌ Error: 'code' command not found!"
    echo "Please make sure VSCode is installed and 'code' is in your PATH."
    echo ""
    echo "To add 'code' to PATH:"
    echo "  1. Open VSCode"
    echo "  2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
    echo "  3. Type 'Shell Command: Install code command in PATH'"
    exit 1
fi

echo "📦 Installing extension..."
code --install-extension "$VSIX_FILE" --force

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Usage:"
echo "  1. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "  2. Type 'SQLite Client: Open SQLite Database'"
echo "  3. Select a .db, .sqlite, or .sqlite3 file"
echo ""
echo "📖 Or right-click on a database file in the Explorer and select 'Open SQLite Database'"

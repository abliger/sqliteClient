#!/bin/bash
# SQLite Client 扩展诊断脚本

echo "========================================="
echo "SQLite Client Extension Diagnostics"
echo "========================================="
echo ""

# 检查 Node.js
echo "1. Node.js 版本:"
node --version 2>/dev/null || echo "   ❌ Node.js 未安装"
echo ""

# 检查 VSCode
echo "2. VSCode 版本:"
code --version 2>/dev/null | head -1 || echo "   ❌ VSCode 命令行工具未安装"
echo ""

# 检查 Python (编译 native 模块需要)
echo "3. Python 版本 (编译需要):"
python3 --version 2>/dev/null || python --version 2>/dev/null || echo "   ⚠️ Python 未安装（可能需要）"
echo ""

# 检查 better-sqlite3
echo "4. better-sqlite3 状态:"
if [ -d "node_modules/better-sqlite3" ]; then
    echo "   ✅ 已安装"
    ls -lh node_modules/better-sqlite3/build/Release/better_sqlite3.node 2>/dev/null || echo "   ⚠️ 原生模块未编译"
else
    echo "   ❌ 未安装"
fi
echo ""

# 检查 VSCode Electron 版本
echo "5. VSCode Electron 版本:"
code --version 2>/dev/null | sed -n '3p' || echo "   无法获取"
echo ""

echo "========================================="
echo "修复建议:"
echo "========================================="
echo ""
echo "如果扩展无法加载，尝试以下步骤:"
echo ""
echo "1. 重新编译 better-sqlite3:"
echo "   cd packages/vscode"
echo "   npm install electron-rebuild"
echo "   npx electron-rebuild -f -w better-sqlite3"
echo ""
echo "2. 或手动指定 VSCode Electron 版本:"
echo "   npm rebuild better-sqlite3 --runtime=electron --target=<vscode-electron-version> --disturl=https://electronjs.org/headers --abi=<abi>"
echo ""
echo "3. 查看 VSCode 开发者工具:"
echo "   在 VSCode 中按 Cmd+Option+I (Mac) 或 Ctrl+Shift+I (Windows/Linux)"
echo "   查看 Console 中的错误信息"
echo ""

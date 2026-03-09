#!/usr/bin/env node
/**
 * Diagnose script for SQLite Client VSCode Extension
 * Run this to check environment compatibility
 */

const os = require('os')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

console.log('='.repeat(60))
console.log('SQLite Client VSCode Extension - Diagnose Tool')
console.log('='.repeat(60))

// System info
console.log('\n📋 System Information:')
console.log(`  Platform: ${os.platform()} ${os.arch()}`)
console.log(`  Node.js: ${process.version}`)

// Try to get VSCode info
try {
    const vscodeVersion = execSync('code --version', { encoding: 'utf-8' }).trim()
    console.log(
        `  VSCode:\n${vscodeVersion
            .split('\n')
            .map(l => '    ' + l)
            .join('\n')}`,
    )
} catch {
    console.log('  VSCode: Not found in PATH')
}

// Check better-sqlite3
try {
    const betterSqlite3Path = require.resolve('better-sqlite3')
    console.log(`\n📦 better-sqlite3 location: ${betterSqlite3Path}`)

    const buildPath = path.join(path.dirname(betterSqlite3Path), 'build', 'Release')
    if (fs.existsSync(buildPath)) {
        const files = fs.readdirSync(buildPath)
        const binaries = files.filter(f => f.endsWith('.node'))
        console.log(`  Compiled binaries: ${binaries.join(', ') || 'None found!'}`)
    } else {
        console.log('  ❌ Build directory not found!')
    }
} catch (err) {
    console.log('\n❌ better-sqlite3 not found:', err.message)
}

// Electron info
try {
    const electronPath = require.resolve('electron')
    const electronPackage = require(path.join(path.dirname(electronPath), 'package.json'))
    console.log(`\n⚛️  Electron version: ${electronPackage.version}`)
} catch {
    console.log('\n⚛️  Electron: Not installed')
}

console.log('\n' + '='.repeat(60))
console.log('Recommendations:')
console.log('='.repeat(60))

console.log(`
If you see "ERR_DLOPEN_FAILED" error:

1. Check if the extension was built for your VSCode version
   - Extension built for Electron 30.x
   - Your VSCode may use a different version

2. To fix, rebuild the native module:
   cd packages/vscode
   npm run rebuild:native
   npm run package

3. Or install prebuilt binaries:
   cd packages/vscode
   npx prebuild-install -t better-sqlite3 -r electron
`)

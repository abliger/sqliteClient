/**
 * Copy native modules and dependencies to dist folder for VSCode extension
 */
const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, '..', 'node_modules')
const destDir = path.join(__dirname, '..', 'dist', 'node_modules')

// Ensure destination exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
}

// Modules to copy
const modulesToCopy = ['better-sqlite3', 'bindings', 'file-uri-to-path']

function copyDir(src, dest, options = {}) {
    const { includeHidden = false, filter = null } = options

    if (!fs.existsSync(src)) {
        console.warn(`Source does not exist: ${src}`)
        return false
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        // Skip hidden files and directories
        if (!includeHidden && entry.name.startsWith('.')) continue

        // Apply custom filter if provided
        if (filter && !filter(entry)) continue

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, options)
        } else {
            try {
                fs.copyFileSync(srcPath, destPath)
            } catch (err) {
                console.warn(`Failed to copy ${srcPath}: ${err.message}`)
            }
        }
    }

    return true
}

console.log('Copying native modules to dist...')

for (const module of modulesToCopy) {
    const src = path.join(srcDir, module)
    const dest = path.join(destDir, module)

    if (!fs.existsSync(src)) {
        console.warn(`Module not found: ${src}`)
        continue
    }

    console.log(`Copying ${module}...`)

    // Copy entire module
    copyDir(src, dest)
}

// Special handling for better-sqlite3: ensure we have binaries for current platform
const betterSqlite3Path = path.join(srcDir, 'better-sqlite3')
if (fs.existsSync(betterSqlite3Path)) {
    console.log('Checking better-sqlite3 binaries...')

    const buildReleasePath = path.join(betterSqlite3Path, 'build', 'Release')
    const prebuildsPath = path.join(betterSqlite3Path, 'prebuilds')

    if (fs.existsSync(buildReleasePath)) {
        const files = fs.readdirSync(buildReleasePath)
        const binaryFiles = files.filter(f => f.endsWith('.node'))
        console.log(`  Found ${binaryFiles.length} binary files in build/Release:`, binaryFiles)
    } else {
        console.warn('  No build/Release directory found!')
    }

    if (fs.existsSync(prebuildsPath)) {
        const prebuilds = fs.readdirSync(prebuildsPath)
        console.log(`  Found prebuilds for platforms:`, prebuilds)
    }
}

// Print architecture info
console.log('\nEnvironment info:')
console.log(`  Platform: ${process.platform}`)
console.log(`  Architecture: ${process.arch}`)
console.log(`  Node version: ${process.version}`)

console.log('\nDone copying native modules.')

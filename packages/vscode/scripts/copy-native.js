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
const modulesToCopy = [
    'better-sqlite3',
    'bindings',
    'file-uri-to-path',
]

function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`Source does not exist: ${src}`)
        return
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        // Skip hidden files and directories
        if (entry.name.startsWith('.')) continue

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

console.log('Copying native modules to dist...')

for (const module of modulesToCopy) {
    const src = path.join(srcDir, module)
    const dest = path.join(destDir, module)
    console.log(`Copying ${module}...`)
    copyDir(src, dest)
}

console.log('Done copying native modules.')

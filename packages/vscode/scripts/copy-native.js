/**
 * 复制 better-sqlite3 原生模块到输出目录
 * VS Code 扩展需要包含原生二进制文件
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/better-sqlite3');
const destDir = path.join(__dirname, '../dist');

// 确保目标目录存在
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// 复制 better-sqlite3 的预编译二进制文件
function copyPrebuilds() {
    const prebuildsDir = path.join(sourceDir, 'build/Release');
    const destPrebuildsDir = path.join(destDir, 'build/Release');
    
    if (!fs.existsSync(prebuildsDir)) {
        console.error('❌ better-sqlite3 build files not found. Run `npm rebuild better-sqlite3` first.');
        process.exit(1);
    }
    
    if (!fs.existsSync(destPrebuildsDir)) {
        fs.mkdirSync(destPrebuildsDir, { recursive: true });
    }
    
    // 复制 better_sqlite3.node 文件
    const sourceFile = path.join(prebuildsDir, 'better_sqlite3.node');
    const destFile = path.join(destPrebuildsDir, 'better_sqlite3.node');
    
    if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, destFile);
        console.log('✅ Copied better_sqlite3.node');
    } else {
        console.error('❌ better_sqlite3.node not found');
        process.exit(1);
    }
    
    // 复制 test_extension.node（如果存在）
    const testExtSource = path.join(prebuildsDir, 'test_extension.node');
    if (fs.existsSync(testExtSource)) {
        fs.copyFileSync(testExtSource, path.join(destPrebuildsDir, 'test_extension.node'));
        console.log('✅ Copied test_extension.node');
    }
}

// 复制 package.json（用于确定模块版本）
function copyPackageJson() {
    const pkgSource = path.join(sourceDir, 'package.json');
    const pkgDest = path.join(destDir, 'better-sqlite3-package.json');
    
    if (fs.existsSync(pkgSource)) {
        fs.copyFileSync(pkgSource, pkgDest);
        console.log('✅ Copied better-sqlite3 package.json');
    }
}

try {
    console.log('📦 Copying better-sqlite3 native modules...');
    copyPrebuilds();
    copyPackageJson();
    console.log('✅ Native modules copied successfully!');
} catch (err) {
    console.error('❌ Failed to copy native modules:', err);
    process.exit(1);
}

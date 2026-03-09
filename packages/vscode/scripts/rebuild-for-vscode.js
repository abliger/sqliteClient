#!/usr/bin/env node
/**
 * 根据当前 VSCode 版本自动检测 Electron 版本并重建 better-sqlite3
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// VSCode 版本与 Electron 版本映射表
// 参考: https://github.com/microsoft/vscode/releases
const vscodeToElectronMap = {
    1.85: '25.8.4',
    1.86: '27.2.3',
    1.87: '27.3.2',
    1.88: '28.2.8',
    1.89: '28.2.8',
    '1.90': '29.4.0',
    1.91: '29.4.0',
    1.92: '30.1.2',
    1.93: '30.4.0',
    1.94: '30.5.1',
    1.95: '32.2.1',
    1.96: '32.2.7',
    1.97: '34.2.0',
    1.98: '34.2.0',
    1.99: '34.2.0',
    '1.100': '35.0.0',
    1.101: '35.0.0',
    1.102: '35.0.0',
    1.103: '35.0.0',
    1.104: '35.0.0',
    1.105: '35.0.0',
    1.106: '35.0.0',
    1.107: '36.0.0',
    1.108: '36.0.0',
    1.109: '39.3.0', // 用户当前版本
    '1.110': '39.3.0',
}

function getVSCodeVersion() {
    try {
        const version = execSync('code --version', { encoding: 'utf8' })
        return version.split('\n')[0].trim()
    } catch {
        return null
    }
}

function getElectronVersion(vscodeVersion) {
    const major = vscodeVersion.split('.').slice(0, 2).join('.')
    return vscodeToElectronMap[major] || '28.2.8' // 默认回退
}

function main() {
    const vscodeVersion = getVSCodeVersion()
    if (!vscodeVersion) {
        console.error('无法检测 VSCode 版本，请确保 code 命令在 PATH 中')
        process.exit(1)
    }

    console.log(`检测到 VSCode 版本: ${vscodeVersion}`)

    const electronVersion = getElectronVersion(vscodeVersion)
    console.log(`对应的 Electron 版本: ${electronVersion}`)

    // 更新 package.json 中的 electron 版本
    const packageJsonPath = path.join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    const oldVersion = packageJson.devDependencies?.electron
    packageJson.devDependencies = packageJson.devDependencies || {}
    packageJson.devDependencies.electron = electronVersion

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4))
    console.log(`更新 package.json: ${oldVersion} -> ${electronVersion}`)

    // 运行重建
    console.log('\n开始重建 better-sqlite3...')
    try {
        execSync('pnpm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
        execSync('pnpm run rebuild:native', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
        console.log('\n✅ 重建完成！')
    } catch (error) {
        console.error('\n❌ 重建失败:', error.message)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}

module.exports = { getElectronVersion, vscodeToElectronMap }

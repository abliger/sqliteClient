// 检查 VSCode 环境
const vscode = require('vscode')
const process = require('process')

function checkEnv() {
    const info = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        vscodeVersion: vscode.version,
    }
    
    console.log('=== VSCode 环境信息 ===')
    console.log(JSON.stringify(info, null, 2))
    
    return info
}

checkEnv()

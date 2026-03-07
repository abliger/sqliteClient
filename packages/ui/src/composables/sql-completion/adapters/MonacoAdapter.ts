import * as monaco from 'monaco-editor'
import type { SQLCompletionStrategy, SchemaDataSource, CompletionContext } from '../types'
import { CompletionItemKind } from '../types'

/**
 * Monaco Editor 适配器
 * 将我们的策略接口适配为 Monaco 的 CompletionItemProvider 接口
 */
export class MonacoAdapter {
    private disposables: monaco.IDisposable[] = []

    constructor(
        private strategies: SQLCompletionStrategy[],
        private schemaSource: SchemaDataSource,
        private triggerCharacters: string[] = ['.', ' ', '\n', ',', '('],
    ) {}

    /**
     * 注册到 Monaco Editor
     */
    register(): monaco.IDisposable {
        const disposable = monaco.languages.registerCompletionItemProvider('sql', {
            triggerCharacters: this.triggerCharacters,
            provideCompletionItems: (model, position) => {
                return this.provideCompletionItems(model, position)
            },
        })

        this.disposables.push(disposable)
        return disposable
    }

    /**
     * 提供补全项（内部方法）
     */
    private async provideCompletionItems(
        model: monaco.editor.ITextModel,
        position: monaco.Position,
    ): Promise<monaco.languages.CompletionList> {
        const context = this.createContext(model, position)
        const suggestions: monaco.languages.CompletionItem[] = []
        const wordInfo = model.getWordUntilPosition(position)

        const range: monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn,
        }

        // 收集所有策略的补全项
        for (const strategy of this.strategies) {
            if (strategy.canProvide(context)) {
                const result = await strategy.provideCompletionItems(context, this.schemaSource)

                const monacoItems = result.items.map(item => ({
                    label: item.label,
                    kind: this.mapKind(item.kind),
                    insertText: item.insertText,
                    detail: item.detail,
                    documentation: item.documentation,
                    sortText: item.sortText,
                    range,
                    insertTextRules: item.insertText.includes('$')
                        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                        : undefined,
                }))

                suggestions.push(...monacoItems)

                // 如果策略返回不完整，可能需要继续查询其他策略
                if (result.isIncomplete) {
                    break
                }
            }
        }

        return {
            suggestions,
            incomplete: false,
        }
    }

    /**
     * 创建补全上下文
     */
    private createContext(
        model: monaco.editor.ITextModel,
        position: monaco.Position,
    ): CompletionContext {
        const textBeforeCursor = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        })

        const lineContent = model.getLineContent(position.lineNumber)
        const textBeforeCursorOnLine = lineContent.substring(0, position.column - 1)

        return {
            lineContent,
            textBeforeCursor,
            textBeforeCursorOnLine,
            position: {
                line: position.lineNumber,
                column: position.column,
            },
        }
    }

    /**
     * 映射 CompletionItemKind
     */
    private mapKind(kind: CompletionItemKind): monaco.languages.CompletionItemKind {
        const mapping: Record<CompletionItemKind, monaco.languages.CompletionItemKind> = {
            [CompletionItemKind.Keyword]: monaco.languages.CompletionItemKind.Keyword,
            [CompletionItemKind.Function]: monaco.languages.CompletionItemKind.Function,
            [CompletionItemKind.Table]: monaco.languages.CompletionItemKind.Class,
            [CompletionItemKind.Column]: monaco.languages.CompletionItemKind.Field,
            [CompletionItemKind.Snippet]: monaco.languages.CompletionItemKind.Snippet,
        }
        return mapping[kind] || monaco.languages.CompletionItemKind.Text
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose())
        this.disposables = []
    }

    /**
     * 更新策略
     */
    updateStrategies(strategies: SQLCompletionStrategy[]): void {
        this.strategies = strategies
    }
}

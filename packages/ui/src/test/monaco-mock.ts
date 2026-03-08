// Import vi from vitest
import { vi } from 'vitest'

// Mock for monaco-editor
export const editor = {
  create: vi.fn(() => ({
    setValue: vi.fn(),
    getValue: vi.fn(() => ''),
    dispose: vi.fn(),
    onDidChangeModelContent: vi.fn((cb) => {
      if (cb) cb()
      return { dispose: vi.fn() }
    }),
    addCommand: vi.fn(),
    addAction: vi.fn(),
    getSelection: vi.fn(() => ({
      isEmpty: vi.fn(() => true),
    })),
    getModel: vi.fn(() => ({
      getValueInRange: vi.fn(() => ''),
      getFullModelRange: vi.fn(() => ({})),
    })),
    saveViewState: vi.fn(() => ({
      cursorState: [{ position: { lineNumber: 1, column: 1 } }],
    })),
    setPosition: vi.fn(),
    revealLineInCenter: vi.fn(),
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
    executeEdits: vi.fn(),
    focus: vi.fn(),
    trigger: vi.fn(),
    getAction: vi.fn(() => null),
  })),
  setTheme: vi.fn(),
}

export const languages = {
  registerDocumentFormattingEditProvider: vi.fn(),
  registerDocumentRangeFormattingEditProvider: vi.fn(),
  registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  CompletionItemKind: {
    Text: 0,
    Method: 1,
    Function: 1,
    Constructor: 2,
    Field: 3,
    Variable: 4,
    Class: 6,
    Struct: 7,
    Interface: 8,
    Module: 9,
    Property: 10,
    Event: 11,
    Operator: 12,
    Unit: 13,
    Value: 14,
    Constant: 15,
    Enum: 16,
    EnumMember: 17,
    Keyword: 17,
    Snippet: 25,
  },
  CompletionItemInsertTextRule: {
    InsertAsSnippet: 4,
  },
}

export const KeyMod = { CtrlCmd: 2048 }
export const KeyCode = { Enter: 3, Slash: 85 }
export const Range = vi.fn((a: number, b: number, c: number, d: number) => ({
  startLineNumber: a,
  startColumn: b,
  endLineNumber: c,
  endColumn: d,
}))

// For default export
export default {
  editor,
  languages,
  KeyMod,
  KeyCode,
  Range,
}

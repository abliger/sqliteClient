import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'

export default defineConfig([
    globalIgnores(
        [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/build/**',
            '**/temp/**',
            '**/tmp/**',
            '**/cache/**',
            '**/target/**',
            '**/*.d.ts',
        ],
        'Ignore Build Directory',
    ),
    js.configs.recommended,
    {
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.es2021,
                ...globals.node,
            },
        },
        rules: {
            semi: ['error', 'never'],
            'no-empty-pattern': 'off',
            'no-console': !isDev ? 'error' : 'off',
            'no-debugger': !isDev ? 'error' : 'off',
            'comma-dangle': ['error', 'only-multiline'],
            'comma-style': ['error', 'last'],
            'func-call-spacing': ['error', 'never'],
            indent: ['error', 4],
            'no-mixed-spaces-and-tabs': 'error',
            'semi-style': ['error', 'last'],
            quotes: ['error', 'single'],
            'padded-blocks': ['error', 'never'],
            'space-before-function-paren': ['error', 'never'],
            'no-extend-native': 'off',
            eqeqeq: ['error', 'smart'],
            'prefer-promise-reject-errors': 'off',
            'no-tabs': ['error', { allowIndentationTabs: true }],
        },
    },
    eslintConfigPrettier,
])

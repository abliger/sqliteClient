import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import { configs } from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import vueParser from 'vue-eslint-parser'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'

export default defineConfig([
    globalIgnores(
        [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'build/**',
            'temp/**',
            'tmp/**',
            'cache/**',
            'src-tauri/**',
        ],
        'Ignore Build Directory',
    ),
    js.configs.recommended,
    configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
                node: {
                    paths: ['node_modules'],
                    extensions: ['.js', '.ts', '.vue'],
                },
            },
        },
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
    },
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    {
        files: ['**/*.{ts,tsx,js,jsx}'],
        rules: {
            semi: ['error', 'never'],
            'import/no-unresolved': 'off',
            'import/extensions': 'off',
            'import/no-absolute-path': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/named': 'off',
            'import/default': 'off',
            'import/namespace': 'off',
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
            complexity: ['warn', { max: 10 }],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parser: vueParser,
            sourceType: 'module',
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                parser: '@typescript-eslint/parser',
                ecmaVersion: 2022,
                sourceType: 'module',
            },
        },
        rules: {
            'import/no-unresolved': 'off',
            'import/named': 'off',
            'import/default': 'off',
            'import/namespace': 'off',
            'vue/no-unused-vars': [
                'error',
                {
                    ignorePattern: '^_',
                },
            ],
            'vue/multi-word-component-names': [
                'warn',
                {
                    ignores: ['Layout', 'Loading', 'Sidebar', 'Toast', 'Tooltip'],
                },
            ],
            'vue/no-async-in-computed-properties': [
                'error',
                {
                    ignoredObjectNames: [],
                },
            ],
            'vue/no-duplicate-attributes': [
                'error',
                {
                    allowCoexistClass: true,
                    allowCoexistStyle: true,
                },
            ],
            'vue/no-mutating-props': 'off',
            'vue/require-default-prop': 'off',
            'vue/no-parsing-error': [
                'error',
                {
                    'abrupt-closing-of-empty-comment': true,
                    'absence-of-digits-in-numeric-character-reference': true,
                    'cdata-in-html-content': true,
                    'character-reference-outside-unicode-range': true,
                    'control-character-in-input-stream': true,
                    'control-character-reference': true,
                    'eof-before-tag-name': true,
                    'eof-in-cdata': true,
                    'eof-in-comment': true,
                    'eof-in-tag': true,
                    'incorrectly-closed-comment': true,
                    'incorrectly-opened-comment': true,
                    'invalid-first-character-of-tag-name': true,
                    'missing-attribute-value': true,
                    'missing-end-tag-name': true,
                    'missing-semicolon-after-character-reference': true,
                    'missing-whitespace-between-attributes': true,
                    'nested-comment': true,
                    'noncharacter-character-reference': true,
                    'noncharacter-in-input-stream': true,
                    'null-character-reference': true,
                    'surrogate-character-reference': true,
                    'surrogate-in-input-stream': true,
                    'unexpected-character-in-attribute-name': true,
                    'unexpected-character-in-unquoted-attribute-value': true,
                    'unexpected-equals-sign-before-attribute-name': true,
                    'unexpected-null-character': true,
                    'unexpected-question-mark-instead-of-tag-name': true,
                    'unexpected-solidus-in-tag': true,
                    'unknown-named-character-reference': true,
                    'end-tag-with-attributes': true,
                    'duplicate-attribute': true,
                    'end-tag-with-trailing-solidus': true,
                    'non-void-html-element-start-tag-with-trailing-solidus': false,
                    'x-invalid-end-tag': true,
                    'x-invalid-namespace': true,
                },
            ],
            'vue/attribute-hyphenation': [
                'error',
                'always',
                {
                    ignore: [],
                    ignoreTags: [],
                },
            ],
            'vue/no-unused-components': [
                'error',
                {
                    ignoreWhenBindingPresent: false,
                },
            ],
            'vue/component-definition-name-casing': ['error', 'PascalCase'],
            'vue/html-closing-bracket-newline': [
                'error',
                {
                    singleline: 'never',
                    multiline: 'always',
                    selfClosingTag: {
                        singleline: 'never',
                        multiline: 'always',
                    },
                },
            ],
            'vue/html-closing-bracket-spacing': [
                'error',
                {
                    startTag: 'never',
                    endTag: 'never',
                    selfClosingTag: 'always',
                },
            ],
            'vue/html-indent': [
                'error',
                4,
                {
                    attribute: 1,
                    baseIndent: 1,
                    closeBracket: 0,
                    alignAttributesVertically: true,
                    ignores: [],
                },
            ],
            'vue/html-quotes': ['error', 'double'],
            'vue/max-attributes-per-line': [
                'error',
                {
                    singleline: {
                        max: 5,
                    },
                    multiline: {
                        max: 2,
                    },
                },
            ],
            'vue/multiline-html-element-content-newline': [
                'error',
                {
                    ignoreWhenEmpty: true,
                    ignores: ['pre', 'textarea'],
                    allowEmptyLines: false,
                },
            ],
            'vue/no-multi-spaces': [
                'error',
                {
                    ignoreProperties: true,
                },
            ],
        },
    },
    eslintConfigPrettier,
])

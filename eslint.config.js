import js from '@eslint/js'
import globals from 'globals'
import vue from 'eslint-plugin-vue'
import stylistic from '@stylistic/eslint-plugin'

/**
 * One style for the whole codebase.
 *
 * The rules below are deliberately few: correctness from eslint and
 * eslint-plugin-vue, and just enough formatting (single quotes, no semicolons,
 * two-space indent) to stop the diff noise that comes from files written at
 * different times in different styles.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', '.firebase/**'] },

  js.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    files: ['**/*.js', '**/*.vue'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 }
    },
    rules: {
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/space-before-function-paren': ['error', 'always'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',

      // The editor renders descriptor blocks that carry no stable id of their
      // own, so a few v-for loops legitimately have nothing to key on.
      'vue/require-v-for-key': 'warn',
      // Long-standing markup in this project puts v-if after v-for on the same
      // element in a couple of places; flagged, not blocking.
      'vue/no-use-v-if-with-v-for': 'warn',
      'vue/multi-word-component-names': 'off',
      // Templates here are written wide; wrapping them adds churn, not clarity.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off'
    }
  },

  {
    files: ['scripts/**/*.{js,mjs}', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } }
  }
]

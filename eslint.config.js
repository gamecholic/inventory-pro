import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../main/*', '../../main/*', 'electron'],
              message: 'Renderer must not import main-process code. Use window.api.* via preload.'
            },
            {
              group: ['fs', 'node:fs', 'better-sqlite3', 'drizzle-orm', 'drizzle-orm/*', 'exceljs'],
              message: 'Renderer never touches fs, the database, or Excel directly. Use window.api.* via preload.'
            }
          ]
        }
      ]
    }
  }
)

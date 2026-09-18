import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import imports from 'eslint-plugin-import-x';
import ts from 'typescript-eslint';

export default [
  {
    ignores: ['lib', 'node_modules', 'android', 'ios', 'build', 'gradle'],
  },

  js.configs.recommended,

  ...ts.configs.recommended.map((config) => ({ ...config, files: ['src/**/*.ts'] })),

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        NodeJS: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
    rules: {
      'max-params': ['error', 2],
    },
  },

  {
    files: ['src/**/*.ts'],
    plugins: { 'import-x': imports },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: [['type'], 'builtin', 'external', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  prettier,
];

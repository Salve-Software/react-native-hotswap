import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

export default [
  {
    ignores: ['lib', 'node_modules', 'android', 'ios', 'build', 'gradle'],
  },

  js.configs.recommended,

  // The TypeScript rules apply to the source only. metro.cjs is required by a consumer's
  // Metro config and has to stay CommonJS, which the recommended set forbids outright.
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
    rules: {
      // TypeScript already resolves every name, and the shared globals list cannot know
      // about types like NodeJS.Timeout.
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

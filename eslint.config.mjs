// @ts-check

import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-electron/',
      'node_modules/',
      '*.cjs',
      '*.js',
      'scripts/',
      'core/',
      'config/',
      'data/',
      'backend/',
      'depotdownloader/',
      'bridge/',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    rules: {
      // Allow `any` — too many existing uses to ban it
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow unused vars starting with underscore
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow require() in certain contexts
      '@typescript-eslint/no-require-imports': 'off',
      // Ban namespace imports from lucide-react (tree-shaking can't optimize them)
      'no-restricted-imports': ['error', {
        name: 'lucide-react',
        importNames: ['*'],
        message: 'Use named imports from lucide-react instead of namespace imports for better tree-shaking.',
      }],
    },
  },
);

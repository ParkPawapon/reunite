import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import { builtinModules } from 'node:module';

const restricted = (patterns, paths = []) => ['error', { patterns, paths }];
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    'tmp/**',
    '.superdesign/**',
    '**/next-env.d.ts',
  ]),
  {
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
    },
  },
  {
    files: ['apps/web/src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted(['react', 'react/*', '@mui/**']),
    },
  },
  {
    files: [
      'apps/web/src/**/domain/**/*.ts',
      'apps/web/src/**/application/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': restricted(
        [
          'next',
          'next/*',
          'react',
          'react/*',
          'zod',
          'pg',
          '@campus/database',
          '@campus/database/*',
          '**/infrastructure/**',
          '**/presentation/**',
          '@/lib/**',
          '@/config/**',
          '@/components/**',
          '@/theme/**',
          'server-only',
          'node:*',
          '@mui/**',
        ],
        builtinModules,
      ),
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted(
        [
          'node:*',
          'pg',
          '@campus/database',
          '@campus/database/*',
          'next',
          'next/*',
          'server-only',
        ],
        builtinModules,
      ),
    },
  },
  {
    files: ['packages/database/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted(['@/*', '**/apps/**']),
    },
  },
  {
    files: [
      'apps/web/src/lib/observability/logger.ts',
      'packages/database/scripts/*.ts',
    ],
    rules: { 'no-console': ['error', { allow: ['info', 'error'] }] },
  },
]);

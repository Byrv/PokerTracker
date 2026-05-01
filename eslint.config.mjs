import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import importPlugin from 'eslint-plugin-import';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Pages may not import module internals.
            { target: './app', from: './lib/modules/*/internal' },
            // Modules may not import other modules' internals.
            { target: './lib/modules/*/internal', from: './lib/modules/*/internal' },
            { target: './lib/modules/*', from: './lib/modules/*/internal', except: ['./internal'] },
            // Tests may not import module internals.
            { target: './tests', from: './lib/modules/*/internal' },
            // Modules may not import directly from supabase-js (use DbBoundary).
            { target: './lib/modules', from: './node_modules/@supabase/supabase-js' },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Import via lib/db/* only — modules use DbBoundary.',
            },
          ],
          patterns: [
            {
              group: ['@/lib/modules/*/internal/*'],
              message: "Internal-folder imports are forbidden — use the module's index.ts.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;

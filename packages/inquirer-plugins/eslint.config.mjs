import baseConfig from '../../eslint.config.mjs'

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredDependencies: [
            '@inquirer/core',
            '@inquirer/type',
            'chalk',
            'cli-cursor',
            'cli-table3',
            'figures',
            'my-gadgetry',
          ], // these libs will be omitted from checks
        },
      ],
    },
  },
]

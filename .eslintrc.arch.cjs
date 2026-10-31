// Merge into your ESLint config. Blocks reaching into another module's internals.
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/modules/*/internal/*'], message: 'Import from the module public-api.ts instead.' },
      ],
    }],
  },
};

import js from '@eslint/js';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Los tipos van en JSDoc solo cuando aportan; no se exigen en todo.
      'jsdoc/tag-lines': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-jsdoc': ['warn', { publicOnly: true }],
    },
  },
  prettier,
];

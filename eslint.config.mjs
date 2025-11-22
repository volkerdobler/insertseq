import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		plugins: {
			prettier: prettierPlugin,
		},
		rules: {
			// basic "airbnb-like" defaults (add more as needed)
			'no-console': 'warn',
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			curly: 'warn',
			eqeqeq: ['warn', 'always'],
			'no-throw-literal': 'warn',
			semi: ['warn', 'always'],
			// 'prettier/prettier': [
			// 	'error',
			// 	{
			// 		trailingComma: 'all',
			// 		singleQuote: true,
			// 		printWidth: 80,
			// 		tabWidth: 2,
			// 		endofLine: 'auto',
			// 	},
			// ],
		},
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: typescriptParser,
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		plugins: {
			'@typescript-eslint': typescriptEslint,
			prettier: prettierPlugin,
		},
		rules: {
			'@typescript-eslint/naming-convention': [
				'warn',
				{ selector: 'import', format: ['camelCase', 'PascalCase'] },
			],
			// keep TS-specific rule mappings as needed
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_' },
			],
			// 'prettier/prettier': [
			// 	'error',
			// 	{
			// 		trailingComma: 'all',
			// 		singleQuote: true,
			// 		printWidth: 80,
			// 		tabWidth: 2,
			// 		endofLine: 'auto',
			// 	},
			// ],
		},
	},
];

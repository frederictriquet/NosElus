/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
	packageManager: 'npm',
	reporters: ['json','html', 'clear-text', 'progress', 'dashboard'],
	testRunner: 'command',
	testRunnerNodeArgs: [],
	commandRunner: {
		command: 'npm run test'
	},
	coverageAnalysis: 'off',
	disableTypeChecks: false,
	mutate: [
		'src/lib/**/*.ts',
		'!src/**/*.test.ts',
		'!src/**/*.spec.ts',
		'!src/**/*.d.ts',
		'!src/**/*.svelte',
		'!src/tests/**',
		'!src/**/*.config.*'
	],
	ignorePatterns: [
		'node_modules',
		'.svelte-kit',
		'build',
		'dist',
		'tests/e2e',
		'playwright.config.ts',
		'*.config.{js,ts,mjs,cjs}'
	],
	timeoutMS: 60000,
	timeoutFactor: 1.5,
	concurrency: 2,
	thresholds: {
		high: 80,
		low: 60,
		break: 50
	},
	incremental: true,
	incrementalFile: '.stryker-tmp/incremental.json'
};

export default config;

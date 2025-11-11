const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function build() {
	const entry = path.resolve(__dirname, 'src', 'extension.ts');
	await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		platform: 'browser',
		target: ['es2020'],
		outfile: path.resolve(__dirname, 'dist', 'extension-web.js'),
		sourcemap: !production,
		// Exclude Node builtins from the browser bundle so the bundler doesn't try to include them
		external: ['vscode'],
		define: { 'process.env.NODE_ENV': '"production"' },
		minify: true,
		logLevel: 'info',
	});
	console.log('Web bundle written to dist/extension-web.js');
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});

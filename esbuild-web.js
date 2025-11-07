const esbuild = require('esbuild');
const path = require('path');

async function build() {
  const entry = path.resolve(__dirname, 'src', 'extension.ts');
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    target: ['es2020'],
    outfile: path.resolve(__dirname, 'out', 'extension-web.js'),
    sourcemap: true,
    // Exclude Node builtins from the browser bundle so the bundler doesn't try to include them
    external: [
      'vscode',
      'fs',
      'path',
      'os',
      'child_process',
      'vm',
      'net',
      'tls',
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: true,
  });
  console.log('Web bundle written to out/extension-web.js');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

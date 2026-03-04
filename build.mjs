import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [
    'extension/src/background.ts',
    'extension/src/popup/popup.ts',
    'extension/src/options/options.ts',
  ],
  bundle: true,
  outdir: '.',
  outbase: '.',
  format: 'esm',
  target: 'chrome120',
  sourcemap: false,
  minify: !isWatch,
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(options);
}

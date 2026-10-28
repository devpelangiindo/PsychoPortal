import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../tmp/article-sharing.test.mjs', import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL('./article-sharing.test.ts', import.meta.url))],
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
});
const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;

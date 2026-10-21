import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");

const output = fileURLToPath(new URL("../tmp/booking-payment-state.test.mjs", import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL("./booking-payment-state.test.ts", import.meta.url))],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  packages: "external",
});
const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
process.exitCode = result.status ?? 1;

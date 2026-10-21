import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const output = fileURLToPath(new URL("../tmp/booking-storage.test.mjs", import.meta.url));
const schema = fileURLToPath(new URL("../../../lib/db/src/schema/schema.ts", import.meta.url));
const testDb = fileURLToPath(new URL("./storage-test-db.ts", import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL("./booking-storage.test.ts", import.meta.url))],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [{ name: "isolated-storage-database", setup(builder) {
    builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: schema }));
    builder.onResolve({ filter: /^drizzle-zod$/ }, () => ({ path: createRequire(schema).resolve("drizzle-zod").replace(/\.cjs$/, ".mjs") }));
    builder.onResolve({ filter: /^\.\/db$/ }, (args) => args.importer.replaceAll("\\", "/").endsWith("/src/storage.ts") ? { path: testDb } : undefined);
  } }],
});
const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit", env: { ...process.env, DATABASE_URL: "" } });
process.exitCode = result.status ?? 1;

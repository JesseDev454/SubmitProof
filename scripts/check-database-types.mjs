import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const generated = execFileSync(
  command,
  [
    "supabase",
    "gen",
    "types",
    "--local",
    "--schema",
    "public",
    "--lang",
    "typescript",
  ],
  {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
    windowsHide: true,
  },
);
const committed = readFileSync(
  resolve(projectRoot, "src/types/database.types.ts"),
  "utf8",
);
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n").trimEnd();

if (normalizeNewlines(generated) !== normalizeNewlines(committed)) {
  process.stderr.write(
    "Database types are out of date. Run npm run db:types and commit the result.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Generated database types match the committed file.\n");
}

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
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
const generatedPath = resolve(projectRoot, "generated-database.types.ts");
const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n").trimEnd();

if (normalizeNewlines(generated) !== normalizeNewlines(committed)) {
  writeFileSync(generatedPath, generated);
  const generatedLines = normalizeNewlines(generated).split("\n");
  const committedLines = normalizeNewlines(committed).split("\n");
  const lineCount = Math.max(generatedLines.length, committedLines.length);
  const firstDifferentLine = Array.from({ length: lineCount }, (_, index) => index).find(
    (index) => generatedLines[index] !== committedLines[index],
  );

  process.stderr.write(
    `Database types are out of date (${generatedLines.length} generated lines, ${committedLines.length} committed lines).\n` +
      `First difference at line ${(firstDifferentLine ?? 0) + 1}:\n` +
      `  generated: ${generatedLines[firstDifferentLine ?? 0] ?? "<end of file>"}\n` +
      `  committed: ${committedLines[firstDifferentLine ?? 0] ?? "<end of file>"}\n` +
      "The generated file was saved to generated-database.types.ts for comparison.\n" +
      "Run npm run db:types and commit the result.\n",
  );
  process.exitCode = 1;
} else {
  rmSync(generatedPath, { force: true });
  process.stdout.write("Generated database types match the committed file.\n");
}

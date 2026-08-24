import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../..");
const shellDir = path.join(rootDir, "docs-site");
const stageDir = path.resolve(
  process.env.DOCS_PUBLIC_STAGE_DIR || path.join(rootDir, ".test-results/docs-public-source"),
);
const readmePath = path.join(rootDir, "README.md");
const readme = await readFile(readmePath, "utf8");
const revision = process.env.DOCS_SOURCE_REVISION
  || execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
const builtAt = process.env.DOCS_BUILD_TIME || new Date().toISOString();
const readmeSha256 = createHash("sha256").update(readme).digest("hex");

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await cp(shellDir, stageDir, { recursive: true });

const frontMatter = [
  "---",
  "layout: guide",
  "title: gulp-rev-all Documentation",
  "description: Content-aware static asset revisioning for Gulp.",
  "---",
  "",
].join("\n");

await writeFile(path.join(stageDir, "index.md"), `${frontMatter}${readme}`, "utf8");
await writeFile(
  path.join(stageDir, "build-metadata.json"),
  `${JSON.stringify({
    project: "gulp-rev-all",
    revision,
    builtAt,
    basePath: "/projects/gulp-rev-all/docs",
    readmeSha256,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Staged README documentation: ${stageDir}`);

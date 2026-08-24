import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../..");
const stageDir = path.resolve(
  process.env.DOCS_PUBLIC_STAGE_DIR || path.join(rootDir, ".test-results/docs-public-source"),
);
const siteDir = path.resolve(
  process.env.DOCS_PUBLIC_SITE_DIR || path.join(rootDir, ".test-results/docs-site"),
);
const basePath = "/projects/gulp-rev-all/docs";
const errors = [];

const readme = await readFile(path.join(rootDir, "README.md"), "utf8");
const staged = await readFile(path.join(stageDir, "index.md"), "utf8");
const metadata = JSON.parse(await readFile(path.join(stageDir, "build-metadata.json"), "utf8"));
const config = await readFile(path.join(stageDir, "_config.yml"), "utf8");

if (!staged.endsWith(readme)) errors.push("staged index does not preserve the complete README");
if ((readme.match(/^#{1,6} /gm) || []).length !== (staged.match(/^#{1,6} /gm) || []).length) {
  errors.push("staged heading count differs from README");
}
if ((readme.match(/^```/gm) || []).length !== (staged.match(/^```/gm) || []).length) {
  errors.push("staged fenced-code count differs from README");
}
if (!config.includes(`baseurl: ${basePath}`)) errors.push("Jekyll baseurl is incorrect");
if (metadata.project !== "gulp-rev-all") errors.push("metadata project is incorrect");
if (metadata.basePath !== basePath) errors.push("metadata base path is incorrect");
if (metadata.readmeSha256 !== createHash("sha256").update(readme).digest("hex")) {
  errors.push("metadata README hash is incorrect");
}

try {
  await stat(path.join(siteDir, "index.html"));
  const html = await readFile(path.join(siteDir, "index.html"), "utf8");
  if (!html.includes(`rel="canonical" href="https://smysnk.com${basePath}/"`)) {
    errors.push("built index canonical URL is incorrect");
  }
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const target = match[1];
    if (target.startsWith("/") && !target.startsWith(`${basePath}/`) && target !== "/projects") {
      errors.push(`built index escapes the docs base path: ${target}`);
    }
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (errors.length) {
  console.error("Documentation validation failed.");
  errors.forEach((error) => console.error(error));
  process.exit(1);
}

console.log("Documentation validation passed.");

import { mkdir, writeFile } from "node:fs/promises";
import Path from "node:path";

const root = process.cwd();
const distDir = Path.join(root, "dist");
const distCjsDir = Path.join(root, "dist-cjs");

await mkdir(distDir, { recursive: true });
await mkdir(distCjsDir, { recursive: true });

await writeFile(
  Path.join(distCjsDir, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  "utf8",
);

const wrapper = `"use strict";

const mod = require("../dist-cjs/index.js");
const exported = mod.default ?? mod;

module.exports = exported;
module.exports.default = exported;
`;

await writeFile(Path.join(distDir, "index.cjs"), wrapper, "utf8");

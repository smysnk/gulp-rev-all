import path from "node:path";

const rootDir = import.meta.dirname;
const outputDir = path.join(rootDir, "artifacts", "workspace-tests");

export default {
  schemaVersion: "1",
  project: {
    name: "gulp-rev-all",
    rootDir,
    outputDir,
    rawDir: path.join(outputDir, "raw"),
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  render: {
    html: true,
    console: true,
  },
  suites: [
    {
      id: "unit-tests",
      label: "Unit Tests",
      adapter: "shell",
      package: "gulp-rev-all",
      cwd: rootDir,
      command: ["npm", "run", "test:unit"],
      coverage: {
        enabled: false,
      },
    },
    {
      id: "lint",
      label: "Lint",
      adapter: "shell",
      package: "gulp-rev-all",
      cwd: rootDir,
      command: ["npm", "run", "lint"],
      coverage: {
        enabled: false,
      },
    },
  ],
  adapters: [],
};

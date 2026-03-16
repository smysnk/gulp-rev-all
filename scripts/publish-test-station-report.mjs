#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = requireNonEmptyString(
    args.input || process.env.TEST_STATION_INGEST_INPUT,
    "input",
  );
  const endpoint = requireNonEmptyString(
    args.endpoint || process.env.TEST_STATION_INGEST_ENDPOINT,
    "endpoint",
  );
  const projectKey = requireNonEmptyString(
    args.projectKey || process.env.TEST_STATION_INGEST_PROJECT_KEY,
    "projectKey",
  );
  const sharedKey = requireNonEmptyString(
    args.sharedKey || process.env.TEST_STATION_INGEST_SHARED_KEY,
    "sharedKey",
  );
  const report = readJson(reportPath);
  const outputDir = path.resolve(args.outputDir || path.dirname(reportPath));
  const payload = {
    projectKey,
    report,
    source: buildGitHubSourceContext({
      buildStartedAt: args.buildStartedAt || process.env.TEST_STATION_BUILD_STARTED_AT,
      buildCompletedAt: args.buildCompletedAt || process.env.TEST_STATION_BUILD_COMPLETED_AT,
      jobStatus: args.jobStatus || process.env.TEST_STATION_CI_STATUS,
      artifactCount: countOutputFiles(outputDir),
    }),
    artifacts: collectOutputArtifacts(outputDir),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${sharedKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = tryParseJson(text);

  if (!response.ok) {
    const detail = body?.error?.message || body?.message || text || `HTTP ${response.status}`;
    throw new Error(`Ingest publish failed (${response.status}): ${detail}`);
  }

  process.stdout.write(
    `Published ${projectKey}:${payload.source.provider}:${payload.source.runId || "manual"} to ${endpoint}\n`,
  );
  if (body?.runId) {
    process.stdout.write(`runId=${body.runId}\n`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    switch (token) {
      case "--input":
        parsed.input = value;
        index += 1;
        break;
      case "--output-dir":
        parsed.outputDir = value;
        index += 1;
        break;
      case "--endpoint":
        parsed.endpoint = value;
        index += 1;
        break;
      case "--project-key":
        parsed.projectKey = value;
        index += 1;
        break;
      case "--shared-key":
        parsed.sharedKey = value;
        index += 1;
        break;
      case "--build-started-at":
        parsed.buildStartedAt = value;
        index += 1;
        break;
      case "--build-completed-at":
        parsed.buildCompletedAt = value;
        index += 1;
        break;
      case "--job-status":
        parsed.jobStatus = value;
        index += 1;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }
  return parsed;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage: publish-test-station-report [options]",
      "",
      "Options:",
      "  --input <report.json>",
      "  --output-dir <report-dir>",
      "  --endpoint <https://host/api/ingest>",
      "  --project-key <project-key>",
      "  --shared-key <shared-key>",
      "  --build-started-at <iso8601>",
      "  --build-completed-at <iso8601>",
      "  --job-status <passed|failed>",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function buildGitHubSourceContext(options = {}, env = process.env) {
  const repository = trimToNull(env.GITHUB_REPOSITORY);
  const serverUrl = trimToNull(env.GITHUB_SERVER_URL) || "https://github.com";
  const runId = trimToNull(env.GITHUB_RUN_ID);
  const branch =
    trimToNull(env.GITHUB_HEAD_REF) ||
    (trimToNull(env.GITHUB_REF_TYPE) === "branch" ? trimToNull(env.GITHUB_REF_NAME) : null);
  const tag = trimToNull(env.GITHUB_REF_TYPE) === "tag" ? trimToNull(env.GITHUB_REF_NAME) : null;
  const startedAt = normalizeTimestamp(options.buildStartedAt) || new Date().toISOString();
  const completedAt = normalizeTimestamp(options.buildCompletedAt) || new Date().toISOString();

  return {
    provider: "github-actions",
    runId,
    runUrl: repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
    repository,
    repositoryUrl: repository ? `${serverUrl}/${repository}` : null,
    branch,
    tag,
    commitSha: trimToNull(env.GITHUB_SHA),
    actor: trimToNull(env.GITHUB_ACTOR),
    startedAt,
    completedAt,
    buildNumber: parseInteger(env.GITHUB_RUN_NUMBER),
    releaseName: tag,
    versionKey: tag ? `tag:${tag}` : null,
    ci: {
      eventName: trimToNull(env.GITHUB_EVENT_NAME),
      workflow: trimToNull(env.GITHUB_WORKFLOW),
      workflowRef: trimToNull(env.GITHUB_WORKFLOW_REF),
      workflowSha: trimToNull(env.GITHUB_WORKFLOW_SHA),
      job: trimToNull(env.GITHUB_JOB),
      ref: trimToNull(env.GITHUB_REF),
      refName: trimToNull(env.GITHUB_REF_NAME),
      refType: trimToNull(env.GITHUB_REF_TYPE),
      runAttempt: parseInteger(env.GITHUB_RUN_ATTEMPT),
      repositoryOwner: trimToNull(env.GITHUB_REPOSITORY_OWNER),
      serverUrl,
      status: trimToNull(options.jobStatus),
      artifactCount: Number.isFinite(options.artifactCount) ? options.artifactCount : null,
    },
  };
}

function collectOutputArtifacts(outputDir) {
  return listFilesRecursively(outputDir)
    .map((absolutePath) => toRelativePosixPath(outputDir, absolutePath))
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => ({
      label: createArtifactLabel(relativePath),
      relativePath,
      href: relativePath,
      kind: "file",
      mediaType: inferMediaType(relativePath),
      storageKey: null,
      sourceUrl: null,
    }));
}

function countOutputFiles(outputDir) {
  return listFilesRecursively(outputDir).length;
}

function listFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function createArtifactLabel(relativePath) {
  switch (relativePath) {
    case "report.json":
      return "Normalized report";
    case "modules.json":
      return "Module rollup";
    case "ownership.json":
      return "Ownership rollup";
    case "index.html":
      return "HTML report";
    default:
      return path.posix.basename(relativePath);
  }
}

function inferMediaType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  switch (extension) {
    case ".json":
      return "application/json";
    case ".html":
      return "text/html";
    case ".txt":
    case ".log":
      return "text/plain";
    case ".zip":
      return "application/zip";
    default:
      return null;
  }
}

function toRelativePosixPath(rootDir, absolutePath) {
  return normalizeRelativePath(path.relative(rootDir, absolutePath));
}

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function trimToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireNonEmptyString(value, label) {
  const normalized = trimToNull(value);
  if (!normalized) {
    throw new Error(`Missing required argument: ${label}`);
  }
  return normalized;
}

function normalizeTimestamp(value) {
  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
}

function parseInteger(value) {
  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function tryParseJson(value) {
  const normalized = trimToNull(value);
  if (!normalized) {
    return null;
  }
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

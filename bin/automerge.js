#!/usr/bin/env node

const { RESULT_SKIPPED } = require("./merge");

const process = require("process");

const fse = require("fs-extra");
const { ArgumentParser } = require("argparse");
const { Octokit } = require("@octokit/rest");
const actionsCore = require("@actions/core");

const { ClientError, logger, createConfig } = require("../lib/common");
const { executeLocally, executeGitHubAction } = require("../lib/api");

const pkg = require("../package.json");

const OLD_CONFIG = [
  "MERGE_LABEL",
  "UPDATE_LABEL",
  "LABELS",
  "AUTOMERGE",
  "AUTOREBASE",
  "COMMIT_MESSAGE_TEMPLATE",
  "TOKEN"
];

async function main() {
  const parser = new ArgumentParser({
    prog: pkg.name,
    add_help: true,
    description: pkg.description
  });
  parser.add_argument("-v", "--version", {
    action: "version",
    version: pkg.version,
    help: "Show version number and exit"
  });
  parser.add_argument("url", {
    metavar: "<url>",
    nargs: "?",
    help: "GitHub URL to process instead of environment variables"
  });

  const args = parser.parse_args();

  if (process.env.LOG === "TRACE") {
    logger.level = "trace";
  } else if (process.env.LOG === "DEBUG") {
    logger.level = "debug";
  } else if (process.env.LOG && process.env.LOG.length > 0) {
    logger.error("Invalid log level:", process.env.LOG);
  }

  checkOldConfig();

  const token = env("GITHUB_TOKEN");

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action"
  });

  const config = createConfig(process.env);
  logger.debug("Configuration:", config);

  const context = { token, octokit, config };

  let results;
  if (args.url) {
    results = await executeLocally(context, args.url);
  } else {
    const eventPath = env("GITHUB_EVENT_PATH");
    const eventName = env("GITHUB_EVENT_NAME");

    const eventDataStr = await fse.readFile(eventPath, "utf8");
    const eventData = JSON.parse(eventDataStr);

    results = await executeGitHubAction(context, eventName, eventData);
    if (Array.isArray(results)) {
      logger.info(
        "got more than one result, setting only first result for action step output"
      );
      results = results[0];
    }
    const { mergeResult, pullRequestNumber } = results || {};
    actionsCore.setOutput("mergeResult", mergeResult || RESULT_SKIPPED);
    actionsCore.setOutput("pullRequestNumber", pullRequestNumber || 0);
  }
  logger.info("Auto-merge action result(s):", results);
}

function checkOldConfig() {
  let error = false;
  for (const old of OLD_CONFIG) {
    if (process.env[old] != null) {
      logger.error("Old configuration option present:", old);
      error = true;
    }
  }
  if (error) {
    logger.error(
      "You have passed configuration options that were used by an old " +
        "version of this action. Please see " +
        "https://github.com/pascalgn/automerge-action for the latest " +
        "documentation of the configuration options!"
    );
    throw new Error(`old configuration present!`);
  }
}

function env(name) {
  const val = process.env[name];
  if (!val || !val.length) {
    throw new ClientError(`environment variable ${name} not set!`);
  }
  return val;
}

if (require.main === module) {
  main().catch(e => {
    if (e instanceof ClientError) {
      process.exitCode = 2;
      logger.error(e);
    } else {
      process.exitCode = 1;
      logger.error(e);
    }
  });
}

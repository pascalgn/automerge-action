#!/usr/bin/env node

const process = require("process");

const fse = require("fs-extra");
const { ArgumentParser } = require("argparse");
const Octokit = require("@octokit/rest");

const { ClientError, logger } = require("../lib/common");
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
    version: pkg.version,
    addHelp: true,
    description: pkg.description
  });
  parser.addArgument(["-t", "--trace"], {
    action: "storeTrue",
    help: "Show trace output"
  });
  parser.addArgument(["-d", "--debug"], {
    action: "storeTrue",
    help: "Show debugging output"
  });
  parser.addArgument(["url"], {
    metavar: "<url>",
    nargs: "?",
    help: "GitHub URL to process instead of environment variables"
  });

  const args = parser.parseArgs();

  if (args.trace) {
    logger.level = "trace";
  } else if (args.debug) {
    logger.level = "debug";
  }

  checkOldConfig();

  const token = env("GITHUB_TOKEN");

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action"
  });

  const mergeLabels = parseLabels(process.env.MERGE_LABELS, "automerge");
  const mergeMethod = process.env.MERGE_METHOD || "merge";
  const mergeForks = process.env.MERGE_FORKS !== "false";
  const mergeCommitMessage = process.env.MERGE_COMMIT_MESSAGE || "automatic";

  const updateLabels = parseLabels(process.env.UPDATE_LABELS, "automerge");
  const updateMethod = process.env.UPDATE_METHOD || "merge";

  const config = {
    mergeLabels,
    mergeMethod,
    mergeForks,
    mergeCommitMessage,
    updateLabels,
    updateMethod
  };

  logger.debug("Configuration:", config);

  const context = { token, octokit, config };

  if (args.url) {
    await executeLocally(context, args.url);
  } else {
    const eventPath = env("GITHUB_EVENT_PATH");
    const eventName = env("GITHUB_EVENT_NAME");

    const eventDataStr = await fse.readFile(eventPath, "utf8");
    const eventData = JSON.parse(eventDataStr);

    await executeGitHubAction(context, eventName, eventData);
  }
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

function parseLabels(str, defaultValue) {
  const arr = (str == null ? defaultValue : str).split(",").map(s => s.trim());
  return {
    required: arr.filter(s => !s.startsWith("!") && s.length > 0),
    blocking: arr
      .filter(s => s.startsWith("!") && s.length > 1)
      .map(s => s.substr(1))
  };
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

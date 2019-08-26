#!/usr/bin/env node

const process = require("process");

const fse = require("fs-extra");
const { ArgumentParser } = require("argparse");
const Octokit = require("@octokit/rest");

const { ClientError, NeutralExitError, logger } = require("../lib/common");
const { executeLocally, executeGitHubAction } = require("../lib/api");

const pkg = require("../package.json");

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

  const token = process.env.TOKEN || env("GITHUB_TOKEN");

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action"
  });

  const labels = parseLabels(process.env.LABELS);
  const automerge = process.env.AUTOMERGE || "automerge";
  const autorebase = process.env.AUTOREBASE || "autorebase";
  const mergeMethod = process.env.MERGE_METHOD || "merge";
  const config = { labels, automerge, autorebase, mergeMethod };

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

function env(name) {
  const val = process.env[name];
  if (!val || !val.length) {
    throw new ClientError(`environment variable ${name} not set!`);
  }
  return val;
}

function parseLabels(str) {
  const labels = {
    required: [],
    blocking: []
  };
  if (str) {
    const arr = str.split(",").map(s => s.trim());
    labels.required = arr.filter(s => !s.startsWith("!"));
    labels.blocking = arr
      .filter(s => s.startsWith("!") && s.length > 1)
      .map(s => s.substr(1));
  }
  return labels;
}

if (require.main === module) {
  main().catch(e => {
    if (e instanceof NeutralExitError) {
      process.exitCode = 0;
    } else if (e instanceof ClientError) {
      process.exitCode = 2;
      logger.error(e);
    } else {
      process.exitCode = 1;
      logger.error(e);
    }
  });
}

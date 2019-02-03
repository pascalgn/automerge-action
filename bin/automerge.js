#!/usr/bin/env node

const fs = require("fs");
const process = require("process");

const { ArgumentParser } = require("argparse");
const Octokit = require("@octokit/rest");

const { ClientError, NeutralExitError, logger } = require("../lib/common");
const { executeLocally, executeGitHubAction } = require("../lib/api");

const package = require("../package.json");

async function main() {
  const parser = new ArgumentParser({
    prog: package.name,
    version: package.version,
    addHelp: true,
    description: package.description
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

  const token = env("GITHUB_TOKEN");

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action"
  });

  if (args.url) {
    await executeLocally(octokit, args.url, token);
  } else {
    const eventPath = env("GITHUB_EVENT_PATH");
    const eventName = env("GITHUB_EVENT_NAME");

    const eventDataStr = await readFile(eventPath);
    const eventData = JSON.parse(eventDataStr);

    await executeGitHubAction(octokit, token, eventName, eventData);
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
    if (e instanceof NeutralExitError) {
      process.exitCode = 78;
    } else if (e instanceof ClientError) {
      process.exitCode = 2;
      logger.error(e);
    } else {
      process.exitCode = 1;
      logger.error(e);
    }
  });
}

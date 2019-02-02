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

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    throw new ClientError("environment variable GITHUB_TOKEN not set!");
  }

  const octokit = new Octokit({
    auth: `token ${GITHUB_TOKEN}`,
    userAgent: "pascalgn/automerge-action"
  });

  if (args.url) {
    await executeLocally(octokit, args.url, GITHUB_TOKEN);
  } else {
    const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
    if (!GITHUB_EVENT_PATH) {
      throw new ClientError("environment variable GITHUB_EVENT_PATH not set!");
    }

    const eventDataStr = await readFile(GITHUB_EVENT_PATH);
    const eventData = JSON.parse(eventDataStr);

    await executeGitHubAction(octokit, GITHUB_TOKEN, eventData);
  }
}

if (require.main === module) {
  main().catch(e => {
    if (e instanceof NeutralExitError) {
      process.exitCode = 78;
    } else if (e instanceof ClientError) {
      process.exitCode = 2;
      logger.error(e.message);
    } else {
      process.exitCode = 1;
      logger.error(e);
    }
  });
}

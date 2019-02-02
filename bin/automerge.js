#!/usr/bin/env node

const fs = require("fs");
const process = require("process");

const { ArgumentParser } = require("argparse");
const Octokit = require("@octokit/rest");

const { ClientError, NeutralExitError, logger } = require("../lib/common");
const { updateLocalInvocation } = require("../lib/api");

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
    throw new ClientError("Environment variable GITHUB_TOKEN not set!");
  }

  const octokit = new Octokit({
    auth: `token ${GITHUB_TOKEN}`
  });

  if (args.url) {
    await updateLocalInvocation(octokit, args.url, GITHUB_TOKEN);
  } else {
    const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
    if (!GITHUB_EVENT_PATH) {
      throw new ClientError("Environment variable GITHUB_EVENT_PATH not set!");
    }

    const eventDataStr = await readFile(GITHUB_EVENT_PATH);
    const eventData = JSON.parse(eventDataStr);

    if (!eventData.pull_request) {
      throw new NeutralExitError();
    }

    if (!eventData || !eventData.pull_request || !eventData.pull_request.head) {
      throw new ClientError(
        `Invalid GITHUB_EVENT_PATH contents: ${eventDataStr}`
      );
    }

    const pullRequestId = {
      owner: eventData.pull_request.head.repo.owner.login,
      repo: eventData.pull_request.head.repo.name,
      number: eventData.pull_request.number
    };

    const pullRequestDiff = await octokit.pulls.get({
      ...pullRequestId,
      headers: {
        accept: "application/vnd.github.v3.diff"
      }
    });
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

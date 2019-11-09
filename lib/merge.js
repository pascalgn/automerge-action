const { logger, retry } = require("./common");

const MAYBE_READY = ["clean", "has_hooks", "unknown", "unstable"];
const NOT_READY = ["dirty", "draft"];

const RETRIES = 6;
const RETRY_SLEEP = 10000;

async function merge(context, pullRequest) {
  if (skipPullRequest(context, pullRequest)) {
    return false;
  }

  logger.info(`Merging PR #${pullRequest.number} ${pullRequest.title}`);

  const {
    head: { sha }
  } = pullRequest;

  const {
    octokit,
    config: { mergeMethod, mergeCommitMessage }
  } = context;

  if (!(await waitUntilReady(octokit, pullRequest))) {
    return false;
  }

  const message = getCommitMessage(mergeCommitMessage, pullRequest);
  if (!(await tryMerge(octokit, pullRequest, sha, mergeMethod, message))) {
    return false;
  }

  logger.info("PR successfully merged!");
  return true;
}

function skipPullRequest(context, pullRequest) {
  const {
    config: { mergeForks, mergeLabels }
  } = context;

  let skip = false;

  if (pullRequest.state !== "open") {
    logger.info("Skipping PR merge, state is not open:", pullRequest.state);
    skip = true;
  }

  if (pullRequest.merged === true) {
    logger.info("Skipping PR merge, already merged!");
    skip = true;
  }

  if (pullRequest.head.repo.full_name !== pullRequest.base.repo.full_name) {
    if (!mergeForks) {
      logger.info("PR is a fork and MERGE_FORKS is false, skipping merge");
      skip = true;
    }
  }

  const labels = pullRequest.labels.map(label => label.name);

  for (const label of pullRequest.labels) {
    if (mergeLabels.blocking.includes(label.name)) {
      logger.info("Skipping PR merge, blocking label present:", label.name);
      skip = true;
    }
  }

  for (const required of mergeLabels.required) {
    if (!labels.includes(required)) {
      logger.info("Skipping PR merge, required label missing:", required);
      skip = true;
    }
  }

  return skip;
}

function waitUntilReady(octokit, pullRequest) {
  return retry(
    RETRIES,
    RETRY_SLEEP,
    () => checkReady(pullRequest),
    async () => {
      const pr = await getPullRequest(octokit, pullRequest);
      return checkReady(pr);
    },
    () => logger.info(`PR not ready to be merged after ${RETRIES} tries`)
  );
}

function checkReady(pullRequest) {
  const { mergeable_state } = pullRequest;
  if (mergeable_state == null || MAYBE_READY.includes(mergeable_state)) {
    logger.info("PR is probably ready: mergeable_state:", mergeable_state);
    return true;
  } else if (NOT_READY.includes(mergeable_state)) {
    logger.info("PR not ready: mergeable_state:", mergeable_state);
    return false;
  } else {
    logger.info("Current PR status: mergeable_state:", mergeable_state);
    return false;
  }
}

async function getPullRequest(octokit, pullRequest) {
  logger.debug("Getting latest PR data...");
  const { data: pr } = await octokit.pulls.get({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    pull_number: pullRequest.number
  });

  logger.trace("PR:", pr);

  return pr;
}

function tryMerge(octokit, pullRequest, head, mergeMethod, commitMessage) {
  return retry(
    RETRIES,
    RETRY_SLEEP,
    () =>
      mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () =>
      mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () => logger.info(`PR could not be merged after ${RETRIES} tries`)
  );
}

function getCommitMessage(mergeCommitMessage, pullRequest) {
  if (mergeCommitMessage === "automatic") {
    return undefined;
  } else if (mergeCommitMessage === "pull-request-title") {
    return pullRequest.title;
  } else if (mergeCommitMessage === "pull-request-description") {
    return pullRequest.body;
  } else if (mergeCommitMessage === "pull-request-title-and-description") {
    return pullRequest.title + "\n\n" + pullRequest.body;
  } else {
    throw new Error(`unknown commit message value: ${mergeCommitMessage}`);
  }
}

async function mergePullRequest(
  octokit,
  pullRequest,
  head,
  mergeMethod,
  commitMessage
) {
  try {
    await octokit.pulls.merge({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
      commit_message: commitMessage,
      sha: head,
      merge_method: mergeMethod
    });
    return true;
  } catch (e) {
    logger.info("Failed to merge PR:", e.message);
    return false;
  }
}

module.exports = { merge };

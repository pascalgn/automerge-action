const { logger, retry } = require("./common");

const MAYBE_READY = ["clean", "has_hooks", "unknown", "unstable"];
const NOT_READY = ["dirty", "draft"];

async function merge(context, pullRequest) {
  logger.info(`Merging PR #${pullRequest.number} ${pullRequest.title}`);

  const {
    head: { sha }
  } = pullRequest;

  const {
    octokit,
    config: { mergeMethod, mergeCommitMessage, mergeRetries, mergeRetrySleep }
  } = context;

  const ready = await waitUntilReady(
    octokit,
    pullRequest,
    mergeRetries,
    mergeRetrySleep
  );
  if (!ready) {
    return false;
  }

  const commitMessage = getCommitMessage(mergeCommitMessage, pullRequest);
  const merged = await tryMerge(
    octokit,
    pullRequest,
    sha,
    mergeMethod,
    mergeRetries,
    mergeRetrySleep,
    commitMessage
  );
  if (!merged) {
    return false;
  }

  logger.info("PR successfully merged!");
  return true;
}

function waitUntilReady(octokit, pullRequest, mergeRetries, mergeRetrySleep) {
  return retry(
    mergeRetries,
    mergeRetrySleep,
    () => checkReady(pullRequest),
    async () => {
      const pr = await getPullRequest(octokit, pullRequest);
      return checkReady(pr);
    },
    () => logger.info(`PR not ready to be merged after ${mergeRetries} tries`)
  );
}

function checkReady(pullRequest) {
  const { mergeable_state } = pullRequest;
  if (mergeable_state == null || MAYBE_READY.includes(mergeable_state)) {
    logger.info("PR is probably ready: mergeable_state:", mergeable_state);
    return "success";
  } else if (NOT_READY.includes(mergeable_state)) {
    logger.info("PR not ready: mergeable_state:", mergeable_state);
    return "failure";
  } else {
    logger.info("Current PR status: mergeable_state:", mergeable_state);
    return "retry";
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

function tryMerge(
  octokit,
  pullRequest,
  head,
  mergeMethod,
  mergeRetries,
  mergeRetrySleep,
  commitMessage
) {
  return retry(
    mergeRetries,
    mergeRetrySleep,
    () =>
      mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () =>
      mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () => logger.info(`PR could not be merged after ${mergeRetries} tries`)
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
    return "success";
  } catch (e) {
    logger.info("Failed to merge PR:", e.message, e);
    return "retry";
  }
}

module.exports = { merge };

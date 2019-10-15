const { NeutralExitError, logger, retry } = require("./common");

const MAYBE_READY = ["clean", "has_hooks", "unknown", "unstable"];
const NOT_READY = ["dirty", "draft"];

const RETRY_SLEEP = 10000;

async function merge(context, pullRequest, head) {
  const {
    octokit,
    config: { mergeMethod, commitMessage }
  } = context;

  await waitUntilReady(octokit, pullRequest);

  await tryMerge(octokit, pullRequest, head, mergeMethod, commitMessage);

  logger.info("PR successfully merged!");
}

async function waitUntilReady(octokit, pullRequest) {
  const retries = 3;
  await retry(
    retries,
    RETRY_SLEEP,
    () => checkReady(pullRequest),
    async () => {
      const pr = await getPullRequest(octokit, pullRequest);
      return checkReady(pr);
    },
    () => {
      logger.info("PR not ready to be merged after", retries, "tries");
      throw new NeutralExitError();
    }
  );
}

function checkReady(pullRequest) {
  const { mergeable_state } = pullRequest;
  if (mergeable_state == null || MAYBE_READY.includes(mergeable_state)) {
    logger.info("PR is probably ready: mergeable_state:", mergeable_state);
    return true;
  } else if (NOT_READY.includes(mergeable_state)) {
    logger.info("PR not ready: mergeable_state:", mergeable_state);
    throw new NeutralExitError();
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

async function tryMerge(octokit, pullRequest, head, mergeMethod, commitMessage) {
  const retries = 3;
  await retry(
    retries,
    RETRY_SLEEP,
    () => mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () => mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage),
    () => {
      logger.info("PR could not be merged after", retries, "tries");
      throw new NeutralExitError();
    }
  );
}

async function mergePullRequest(octokit, pullRequest, head, mergeMethod, commitMessage) {
  try {
    await octokit.pulls.merge({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
      commit_message: getCommitMessage(commitMessage, pullRequest),
      sha: head,
      merge_method: mergeMethod
    });
    return true;
  } catch (e) {
    logger.info("Failed to merge PR:", e.message);
    return false;
  }
}

function getCommitMessage(commitMessage, pullRequest) {
  if (commitMessage === "automatic") {
    return undefined;
  } else if (commitMessage === "pull-request-title") {
    return pullRequest.title;
  } else if (commitMessage === "pull-request-description") {
    return pullRequest.body;
  } else if (commitMessage === "pull-request-title-and-description") {
    return pullRequest.title + "\n\n" + pullRequest.body;
  } else {
    throw new Error(`Unknown commit message value: ${commitMessage}`);
  }
}

module.exports = { merge };

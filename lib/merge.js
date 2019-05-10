const { NeutralExitError, logger, retry } = require("./common");

const MAYBE_READY = ["clean", "has_hooks", "unknown", "unstable"];
const NOT_READY = ["dirty", "draft"];

const RETRY_SLEEP = 10000;

async function merge(context, pullRequest, head) {
  const { octokit, config: { mergeMethod } } = context;

  await waitUntilReady(octokit, pullRequest);

  await tryMerge(octokit, pullRequest, head, mergeMethod);

  logger.info("PR successfully merged!");

  const { data: branch } = await octokit.repos.getBranch({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    branch: pullRequest.head.ref
  });

  logger.trace("Branch:", branch);

  if (branch.protected) {
    logger.info("Branch is protected and cannot be deleted:", branch.name);
  } else {
    logger.debug("Deleting branch", branch.name, "...");
    await octokit.git.deleteRef({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      ref: `heads/${branch.name}`
    });

    logger.info("Merged branch has been deleted:", branch.name);
  }
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

async function tryMerge(octokit, pullRequest, head, mergeMethod) {
  const retries = 3;
  await retry(
    retries,
    RETRY_SLEEP,
    () => mergePullRequest(octokit, pullRequest, head, mergeMethod),
    () => mergePullRequest(octokit, pullRequest, head, mergeMethod),
    () => {
      logger.info("PR could not be merged after", retries, "tries");
      throw new NeutralExitError();
    }
  );
}

async function mergePullRequest(octokit, pullRequest, head, mergeMethod) {
  try {
    await octokit.pulls.merge({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
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

const { NeutralExitError, logger } = require("./common");

async function merge(octokit, pullRequest, head) {
  if (pullRequest.mergeable_state !== "clean") {
    logger.info("PR not ready to be merged:", pullRequest.mergeable_state);
    throw new NeutralExitError();
  }

  await octokit.pulls.merge({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    number: pullRequest.number,
    sha: head,
    merge_method: "merge"
  });

  logger.info("PR successfully merged!");

  await octokit.git.deleteRef({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    ref: `heads/${pullRequest.head.ref}`
  });

  logger.info("Merged branch has been deleted:", pullRequest.head.ref);
}

module.exports = { merge };

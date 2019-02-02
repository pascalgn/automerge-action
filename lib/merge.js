const { NeutralExitError, logger } = require("./common");

async function merge(octokit, pullRequest, head) {
  if (pullRequest.mergeable_state !== "clean") {
    logger.info("PR not ready to be merged:", pullRequest.mergeable_state);
    throw new NeutralExitError();
  }

  if (head !== pullRequest.head.sha) {
    logger.info("PR has just been updated, not merging now");
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

module.exports = { merge };

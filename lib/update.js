const { logger, NeutralExitError } = require("./common");
const git = require("./git");

const FETCH_TIMEOUT = 60000;

async function update(context, dir, url, pullRequest) {
  logger.info(`Updating PR #${pullRequest.number} ${pullRequest.title}`);

  if (pullRequest.merged === true) {
    logger.info("PR is already merged!");
    throw new NeutralExitError();
  }

  const { octokit, config } = context;
  const { automerge, autorebase, enableFork } = config;
  const actions = [automerge, autorebase];

  if (pullRequest.head.repo.full_name !== pullRequest.base.repo.full_name) {
    if (!enableFork) {
      logger.info("PR branch is from external repository, skipping");
      throw new NeutralExitError();  
    }
  }
  
  let action = null;
  for (const label of pullRequest.labels) {
    if (actions.includes(label.name)) {
      if (action === null) {
        action = label.name;
      } else {
        throw new Error(`ambiguous labels: ${action} + ${label.name}`);
      }
    }
  }

  if (action === null) {
    logger.info("No matching labels found on PR, skipping");
    throw new NeutralExitError();
  }

  if (!octokit || !dir || !url) {
    throw new Error("invalid arguments!");
  }

  if (action === automerge) {
    return await merge(octokit, pullRequest);
  } else if (action === autorebase) {
    return await rebase(dir, url, pullRequest);
  } else {
    throw new Error(`invalid action: ${action}`);
  }
}

async function merge(octokit, pullRequest) {
  const state = await pullRequestState(octokit, pullRequest);
  if (state === "behind") {
    const headRef = pullRequest.head.ref;
    const baseRef = pullRequest.base.ref;

    logger.debug("Merging latest changes from", baseRef, "into", headRef);
    const { status, data } = await octokit.repos.merge({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      base: headRef,
      head: baseRef
    });

    logger.trace("Merge result:", status, data);

    if (status === 204) {
      logger.info("No merge performed, branch is up to date!");
      return pullRequest.head.sha;
    } else {
      logger.info("Merge succeeded, new HEAD:", headRef, data.sha);
      return data.sha;
    }
  } else if (
    state === "clean" ||
    state === "has_hooks" ||
    state === "unknown"
  ) {
    logger.info("No update necessary");
    return pullRequest.head.sha;
  } else {
    logger.info("No update done due to PR state", state);
    throw new NeutralExitError();
  }
}

async function pullRequestState(octokit, pullRequest) {
  if (pullRequest.mergeable_state) {
    return pullRequest.mergeable_state;
  } else {
    logger.debug("Getting pull request info for", pullRequest.number, "...");
    const { data: fullPullRequest } = await octokit.pulls.get({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number
    });

    logger.trace("Full PR:", fullPullRequest);

    return fullPullRequest.mergeable_state;
  }
}

async function rebase(dir, url, pullRequest) {
  const headRef = pullRequest.head.ref;
  const baseRef = pullRequest.base.ref;

  logger.debug("Cloning into", dir, `(${headRef})`);
  await git.clone(url, dir, headRef);

  logger.debug("Fetching", baseRef, "...");
  await git.fetch(dir, baseRef);
  await git.fetchUntilMergeBase(dir, baseRef, FETCH_TIMEOUT);

  const head = await git.head(dir);
  if (head !== pullRequest.head.sha) {
    logger.info(`HEAD changed to ${head}, skipping`);
    throw new NeutralExitError();
  }

  logger.info(headRef, "HEAD:", head);

  const onto = await git.sha(dir, baseRef);

  logger.info("Rebasing onto", baseRef, onto);
  await git.rebase(dir, onto);

  const newHead = await git.head(dir);
  if (newHead === head) {
    logger.info("Already up to date:", headRef, "->", baseRef, onto);
  } else {
    logger.debug("Pushing changes...");
    await git.push(dir, true, headRef);

    logger.info("Updated:", headRef, head, "->", newHead);
  }

  return newHead;
}

module.exports = { update };

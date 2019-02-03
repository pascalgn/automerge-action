const { logger, NeutralExitError } = require("./common");
const git = require("./git");

const ACTIONS = ["automerge", "autorebase"];

async function update(octokit, dir, url, pullRequest) {
  logger.info(`Updating PR #${pullRequest.number} ${pullRequest.title}`);

  if (pullRequest.merged === true) {
    logger.info("PR is already merged!");
    throw new NeutralExitError();
  }

  if (pullRequest.head.repo.full_name !== pullRequest.base.repo.full_name) {
    logger.info("PR branch is from external repository, skipping");
    throw new NeutralExitError();
  }

  let action = null;
  for (const label of pullRequest.labels) {
    if (ACTIONS.includes(label.name)) {
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

  if (action === "automerge") {
    return await merge(octokit, pullRequest);
  } else if (action === "autorebase") {
    const baseCommits = await listBaseCommits(octokit, pullRequest);
    return await rebase(dir, url, pullRequest, baseCommits);
  } else {
    throw new Error(`invalid action: ${action}`);
  }
}

async function merge(octokit, pullRequest) {
  const state = pullRequest.mergeable_state;
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
  } else if (state === "clean" || state === "has_hooks") {
    logger.info("No update necessary");
    return pullRequest.head.sha;
  } else {
    logger.info("No update done due to PR state", state);
    throw new NeutralExitError();
  }
}

async function listBaseCommits(octokit, pullRequest) {
  logger.debug("Listing commits...");
  const { data: commits } = await octokit.pulls.listCommits({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    number: pullRequest.number,
    per_page: 1
  });
  const tailCommit = commits[0];

  logger.trace("Tail commit:", tailCommit);

  logger.debug("Getting base commits...");
  const baseCommits = [];
  for (const parent of tailCommit.parents) {
    const { data: commit } = await octokit.git.getCommit({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      commit_sha: parent.sha
    });
    baseCommits.push(commit);
  }

  logger.trace("Base commits:", baseCommits);

  return baseCommits;
}

async function rebase(dir, url, pullRequest, baseCommits) {
  const headRef = pullRequest.head.ref;
  const baseRef = pullRequest.base.ref;

  logger.debug("Cloning into", dir, `(${headRef})`);
  await git.clone(url, dir, headRef, pullRequest.commits + 1);

  logger.debug("Fetching", baseRef, "...");
  const since = earliestDate(baseCommits);
  if (since === null) {
    await git.fetchHead(dir, baseRef);
  } else {
    await git.fetchSince(dir, baseRef, since);
  }

  const head = await git.head(dir);
  if (head !== pullRequest.head.sha) {
    logger.info(`HEAD changed to ${head}, skipping`);
    throw new NeutralExitError();
  }

  logger.info(headRef, "HEAD:", head, `(${pullRequest.commits} commits)`);

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

function earliestDate(commits) {
  let date = null;
  for (const commit of commits || []) {
    if (date === null || commit.committer.date < date) {
      date = commit.committer.date;
    }
  }
  return date;
}

module.exports = { update, earliestDate };

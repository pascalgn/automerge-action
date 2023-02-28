const { logger, tmpdir, sleep } = require("./common");
const git = require("./git");

const FETCH_TIMEOUT = 60000;

async function update(context, pullRequest) {
  if (skipPullRequest(context, pullRequest)) {
    return false;
  }

  logger.info(`Updating PR #${pullRequest.number} ${pullRequest.title}`);

  const { head } = pullRequest;

  const {
    token,
    octokit,
    config: { updateMethod, updateRetries, updateRetrySleep, hostname }
  } = context;

  let newSha;

  if (updateMethod === "merge") {
    newSha = await merge(octokit, updateRetries, updateRetrySleep, pullRequest);
  } else if (updateMethod === "rebase") {
    const { full_name } = head.repo;
    const url = `https://x-access-token:${token}@${hostname}/${full_name}.git`;
    newSha = await tmpdir(path => rebase(path, url, pullRequest));
  } else {
    throw new Error(`invalid update method: ${updateMethod}`);
  }

  if (newSha != null && newSha != head.sha) {
    head.sha = newSha;
    return true;
  } else {
    return false;
  }
}

function skipPullRequest(context, pullRequest) {
  const {
    config: { updateLabels }
  } = context;

  let skip = false;

  if (pullRequest.state !== "open") {
    logger.info("Skipping PR update, state is not open:", pullRequest.state);
    skip = true;
  }

  if (pullRequest.merged === true) {
    logger.info("Skipping PR update, already merged!");
    skip = true;
  }

  const labels = pullRequest.labels.map(label => label.name);

  for (const label of pullRequest.labels) {
    if (updateLabels.blocking.includes(label.name)) {
      logger.info("Skipping PR update, blocking label present:", label.name);
      skip = true;
    }
  }

  for (const required of updateLabels.required) {
    if (!labels.includes(required)) {
      logger.info("Skipping PR update, required label missing:", required);
      skip = true;
    }
  }

  return skip;
}

async function merge(octokit, updateRetries, updateRetrySleep, pullRequest) {
  const mergeableState = await pullRequestState(
    octokit,
    updateRetries,
    updateRetrySleep,
    pullRequest
  );
  if (mergeableState === "behind") {
    const headRef = pullRequest.head.ref;
    const baseRef = pullRequest.base.ref;

    logger.debug("Merging latest changes from", baseRef, "into", headRef);
    const { status, data } = await octokit.repos.merge({
      owner: pullRequest.base.repo.owner.login,
      repo: pullRequest.base.repo.name,
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
  } else if (mergeableState === "clean" || mergeableState === "has_hooks") {
    logger.info("No update necessary, mergeable_state:", mergeableState);
    return pullRequest.head.sha;
  } else {
    logger.info("No update done due to PR mergeable_state", mergeableState);
    return null;
  }
}

async function pullRequestState(
  octokit,
  updateRetries,
  updateRetrySleep,
  pullRequest
) {
  if (pullRequest.mergeable_state != null) {
    return pullRequest.mergeable_state;
  } else {
    logger.debug("Getting pull request info for", pullRequest.number, "...");
    let { data: fullPullRequest } = await octokit.pulls.get({
      owner: pullRequest.base.repo.owner.login,
      repo: pullRequest.base.repo.name,
      pull_number: pullRequest.number
    });

    logger.trace("Full PR:", fullPullRequest);

    for (let run = 1; run <= updateRetries; run++) {
      if (fullPullRequest.mergeable_state != null) {
        break;
      } else {
        logger.info("Unknown PR state, mergeable_state: null");
        logger.info(
          `Retrying after ${updateRetrySleep} ms ... (${run}/${updateRetries})`
        );

        await sleep(updateRetrySleep);

        const { data } = await octokit.pulls.get({
          owner: pullRequest.base.repo.owner.login,
          repo: pullRequest.base.repo.name,
          pull_number: pullRequest.number,
          headers: { "If-None-Match": "" }
        });
        fullPullRequest = data;
      }
    }

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
    return null;
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

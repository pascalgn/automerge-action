const { logger, retry } = require("./common");

const MAYBE_READY = ["clean", "has_hooks", "unknown", "unstable"];
const NOT_READY = ["dirty", "draft"];

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
    config: {
      mergeMethod,
      mergeCommitMessage,
      mergeCommitMessageRegex,
      mergeRemoveLabels,
      mergeRetries,
      mergeRetrySleep
    }
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

  if (mergeCommitMessageRegex) {
    // If we find the regex, use the first capturing subgroup as new body (discarding whitespace).
    const m = new RegExp(mergeCommitMessageRegex, 'sm').exec(pullRequest.body);
    if (m) {
      if (m[1] === undefined) {
        throw new Error(`MERGE_COMMIT_MESSAGE_REGEX must contain a capturing subgroup: '${mergeCommitMessageRegex}'`);
      }
      pullRequest.body = m[1].trim();
    }
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

  try {
    await removeLabels(octokit, pullRequest, mergeRemoveLabels);
  } catch (e) {
    logger.info("Failed to remove labels:", e.message);
  }

  if (context.config.mergeDeleteBranch) {
    try {
      await deleteBranch(octokit, pullRequest);
    } catch (e) {
      logger.info("Failed to delete branch:", e.message);
    }
  }

  return true;
}

async function removeLabels(octokit, pullRequest, mergeRemoveLabels) {
  const labels = pullRequest.labels.filter(label =>
    mergeRemoveLabels.includes(label.name)
  );

  if (labels.length < 1) {
    logger.debug("No labels to remove.");
    return;
  }

  logger.debug("Removing labels:", labels);

  await Promise.all(
    labels.map(label =>
      octokit.issues.deleteLabel({
        owner: pullRequest.base.repo.owner.login,
        repo: pullRequest.base.repo.name,
        issue_number: pullRequest.number,
        name: label.name
      })
    )
  );

  logger.info("Removed labels:", labels);
}

async function deleteBranch(octokit, pullRequest) {
  if (pullRequest.head.repo.full_name !== pullRequest.base.repo.full_name) {
    logger.info("Branch is from external repository, skipping delete");
    return;
  }

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
    owner: pullRequest.base.repo.owner.login,
    repo: pullRequest.base.repo.name,
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
    async () => {
      const pr = await getPullRequest(octokit, pullRequest);
      if (pr.merged === true) {
        return "success";
      }
      return mergePullRequest(
        octokit,
        pullRequest,
        head,
        mergeMethod,
        commitMessage
      );
    },
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
    ["number", "title", "body"].forEach(prProp => {
      mergeCommitMessage = mergeCommitMessage.replace(
        new RegExp(`{pullRequest.${prProp}}`, "g"),
        pullRequest[prProp]
      );
    });
    return mergeCommitMessage;
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
      owner: pullRequest.base.repo.owner.login,
      repo: pullRequest.base.repo.name,
      pull_number: pullRequest.number,
      commit_message: commitMessage,
      sha: head,
      merge_method: mergeMethod
    });
    return "success";
  } catch (e) {
    return checkMergeError(e);
  }
}

function checkMergeError(e) {
  const m = e ? e.message || "" : "";
  if (
    m.includes("review is required by reviewers with write access") ||
    m.includes("reviews are required by reviewers with write access")
  ) {
    logger.info("Cannot merge PR:", m);
    return "failure";
  } else {
    logger.info("Failed to merge PR:", m);
    return "retry";
  }
}

module.exports = { merge };

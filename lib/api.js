const process = require("process");

const { ClientError, logger } = require("./common");
const { update } = require("./update");
const { merge } = require("./merge");

const URL_REGEXP = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/(pull|tree)\/([^ ]+)$/;

const RELEVANT_ACTIONS = [
  "labeled",
  "unlabeled",
  "synchronize",
  "opened",
  "edited",
  "ready_for_review",
  "reopened",
  "unlocked"
];

// we'll only update a few PRs at once:
const MAX_PR_COUNT = 10;

async function executeLocally(context, url) {
  const { octokit } = context;

  const m = url.match(URL_REGEXP);
  if (m && m[3] === "pull") {
    logger.debug("Getting PR data...");
    const { data: pull_request } = await octokit.pulls.get({
      owner: m[1],
      repo: m[2],
      pull_number: m[4]
    });

    const event = {
      action: "opened",
      pull_request
    };

    await executeGitHubAction(context, "pull_request", event);
  } else if (m && m[3] === "tree") {
    const event = {
      ref: `refs/heads/${m[4]}`,
      repository: {
        name: m[2],
        owner: {
          name: m[1]
        }
      }
    };

    await executeGitHubAction(context, "push", event);
  } else {
    throw new ClientError(`invalid URL: ${url}`);
  }
}

async function executeGitHubAction(context, eventName, eventData) {
  logger.info("Event name:", eventName);
  logger.trace("Event data:", eventData);

  if (eventName === "push") {
    await handleBranchUpdate(context, eventName, eventData);
  } else if (eventName === "status") {
    await handleStatusUpdate(context, eventName, eventData);
  } else if (eventName === "pull_request") {
    await handlePullRequestUpdate(context, eventName, eventData);
  } else if (eventName === "check_suite" || eventName === "check_run") {
    await handleCheckUpdate(context, eventName, eventData);
  } else if (eventName === "pull_request_review") {
    await handlePullRequestReviewUpdate(context, eventName, eventData);
  } else if (eventName === "schedule") {
    await handleScheduleTrigger(context);
  } else {
    throw new ClientError(`invalid event type: ${eventName}`);
  }
}

async function handlePullRequestUpdate(context, eventName, event) {
  const { action } = event;
  if (!RELEVANT_ACTIONS.includes(action)) {
    logger.info("Action ignored:", eventName, action);
    return;
  }

  await update(context, event.pull_request);
  await merge(context, event.pull_request);
}

async function handleCheckUpdate(context, eventName, event) {
  const { action } = event;
  if (action !== "completed") {
    logger.info("A status check is not yet complete:", eventName);
  } else {
    const payload =
      eventName === "check_suite" ? event.check_suite : event.check_run;
    if (payload.conclusion === "success") {
      logger.info("Status check completed successfully");
      const checkPullRequest = payload.pull_requests[0];
      if (checkPullRequest != null) {
        const { octokit } = context;
        const { data: pullRequest } = await octokit.request(
          checkPullRequest.url
        );
        logger.trace("PR:", pullRequest);

        await update(context, pullRequest);
        await merge(context, pullRequest);
      } else {
        const branchName = payload.head_branch;
        if (branchName != null) {
          await checkPullRequestsForBranches(context, event, branchName);
        } else {
          logger.info("Could not find branch name in this status check result");
        }
      }
    } else {
      logger.info("A status check completed unsuccessfully:", eventName);
    }
  }
}

async function handlePullRequestReviewUpdate(context, eventName, event) {
  const { action, review } = event;
  if (action === "submitted") {
    if (review.state === "approved") {
      await update(context, event.pull_request);
      await merge(context, event.pull_request);
    } else {
      logger.info("Review state is not approved:", review.state);
      logger.info("Action ignored:", eventName, action);
    }
  } else {
    logger.info("Action ignored:", eventName, action);
  }
}

async function handleStatusUpdate(context, eventName, event) {
  const { state, branches } = event;
  if (state !== "success") {
    logger.info("Event state ignored:", eventName, state);
    return;
  }

  if (!branches || branches.length === 0) {
    logger.info("No branches have been referenced:", eventName);
    return;
  }

  for (const branch of branches) {
    await checkPullRequestsForBranches(context, event, branch.name);
  }
}

async function checkPullRequestsForBranches(context, event, branchName) {
  const { octokit } = context;
  logger.debug("Listing pull requests for", branchName, "...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    state: "open",
    head: `${event.repository.owner.login}:${branchName}`,
    sort: "updated",
    direction: "desc",
    per_page: MAX_PR_COUNT
  });

  logger.trace("PR list:", pullRequests);

  let updated = 0;
  for (const pullRequest of pullRequests) {
    try {
      await update(context, pullRequest);
      await merge(context, pullRequest);
      ++updated;
    } catch (e) {
      logger.error(e);
    }
  }

  if (updated === 0) {
    logger.info("No PRs have been updated/merged");
  }
}

async function handleBranchUpdate(context, eventName, event) {
  const { ref } = event;
  if (!ref.startsWith("refs/heads/")) {
    logger.info("Push does not reference a branch:", ref);
    return;
  }

  const branch = ref.substr(11);
  logger.debug("Updated branch:", branch);

  const { octokit } = context;

  logger.debug("Listing pull requests...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    state: "open",
    base: branch,
    sort: "updated",
    direction: "desc",
    per_page: MAX_PR_COUNT
  });

  logger.trace("PR list:", pullRequests);

  if (pullRequests.length > 0) {
    logger.info("Open PRs:", pullRequests.length);
  } else {
    logger.info("No open PRs for", branch);
    return;
  }

  let updated = 0;

  for (const pullRequest of pullRequests) {
    try {
      await update(context, pullRequest);
      updated++;
    } catch (e) {
      logger.error(e);
    }
  }

  if (updated > 0) {
    logger.info(updated, "PRs based on", branch, "have been updated");
  } else {
    logger.info("No PRs based on", branch, "have been updated");
  }
}

async function handleScheduleTrigger(context) {
  const { octokit } = context;

  const { GITHUB_REPOSITORY } = process.env;
  const [owner, repo] = (GITHUB_REPOSITORY || "").split("/", 2);

  if (!owner || !repo) {
    throw new Error(`invalid GITHUB_REPOSITORY value: ${GITHUB_REPOSITORY}`);
  }

  logger.debug("Listing pull requests ...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: MAX_PR_COUNT
  });

  logger.trace("PR list:", pullRequests);

  let updated = 0;
  for (const pullRequest of pullRequests) {
    try {
      await update(context, pullRequest);
      await merge(context, pullRequest);
      ++updated;
    } catch (e) {
      logger.error(e);
    }
  }

  if (updated === 0) {
    logger.info("No PRs have been updated/merged");
    return;
  }
}

module.exports = { executeLocally, executeGitHubAction };

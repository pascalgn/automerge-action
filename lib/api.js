const process = require("process");

const { ClientError, logger } = require("./common");
const { update } = require("./update");
const { merge } = require("./merge");
const { branchName } = require("./util");

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

  if (["push"].includes(eventName)) {
    await handleBaseBranchUpdate(context, eventName, eventData);
  } else if (["status"].includes(eventName)) {
    await handleStatusUpdate(context, eventName, eventData);
  } else if (["pull_request", "pull_request_target"].includes(eventName)) {
    await handlePullRequestUpdate(context, eventName, eventData);
  } else if (["check_suite", "check_run"].includes(eventName)) {
    await handleCheckUpdate(context, eventName, eventData);
  } else if (["pull_request_review"].includes(eventName)) {
    await handlePullRequestReviewUpdate(context, eventName, eventData);
  } else if (["schedule", "repository_dispatch"].includes(eventName)) {
    await handleScheduleTriggerOrRepositoryDispatch(context);
  } else if (["issue_comment"].includes(eventName)) {
    await handleIssueComment(context, eventName, eventData);
  } else if (["workflow_dispatch"].includes(eventName)) {
    await handleWorkflowDispatch(context, eventName, eventData);
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

  const pullRequest = await fetchPullRequest(
    context,
    event.pull_request.base.repo,
    event.pull_request
  );

  await update(context, pullRequest);
  await merge(context, pullRequest);
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
          await checkPullRequestsForHeadSha(
            context,
            event.repository,
            payload.head_sha
          );
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
      const pullRequest = await fetchPullRequest(
        context,
        event.pull_request.base.repo,
        event.pull_request
      );
      await update(context, pullRequest);
      await merge(context, pullRequest);
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

async function checkPullRequestsForHeadSha(context, repo, head_sha) {
  const { octokit } = context;
  logger.debug("Listing pull requests to look for", head_sha, "...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner: repo.owner.login,
    repo: repo.name,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: MAX_PR_COUNT
  });

  let updated = 0;
  let foundPR = false;
  for (const pullRequest of pullRequests) {
    if (pullRequest.head.sha !== head_sha) {
      continue;
    }
    foundPR = true;
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
  if (!foundPR) {
    logger.info(
      "Could not find branch name in this status check result" +
        " or corresponding PR from a forked repository"
    );
  }
}

async function handleBaseBranchUpdate(context, eventName, event) {
  const { ref } = event;
  const branch = branchName(ref);
  if (!branch) {
    logger.info("Push does not reference a branch:", ref);
    return;
  }

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

async function handleWorkflowDispatch(context, eventName, event) {
  const { ref } = event;
  const branch = branchName(ref);
  if (!branch) {
    logger.info("Dispatch does not reference a branch:", ref);
    return;
  }

  await checkPullRequestsForBranches(context, event, branch);
}

async function handleScheduleTriggerOrRepositoryDispatch(context) {
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

async function handleIssueComment(context, eventName, event) {
  const { action, issue, repository } = event;
  if (action === "created") {
    if (issue.pull_request == null) {
      logger.info("Comment not on a PR, skipping");
    } else {
      const pullRequest = await fetchPullRequest(context, repository, issue);
      await update(context, pullRequest);
      await merge(context, pullRequest);
    }
  } else {
    logger.info("Action ignored:", eventName, action);
  }
}

async function fetchPullRequest(context, repository, issue) {
  const { octokit } = context;
  const { number } = issue;

  logger.debug("Getting pull request info for", number, "...");
  let { data: pullRequest } = await octokit.pulls.get({
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number
  });

  logger.trace("Full PR:", pullRequest);
  return pullRequest;
}

module.exports = { executeLocally, executeGitHubAction };

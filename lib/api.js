const { ClientError, NeutralExitError, logger, tmpdir } = require("./common");
const { update } = require("./update");
const { merge } = require("./merge");

const URL_REGEXP = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/(pull|tree)\/([^ ]+)$/;

const RELEVANT_ACTIONS = [
  "labeled",
  "unlabeled",
  "opened",
  "edited",
  "synchronize"
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
  } else if (eventName === "pull_request_review") {
    await handlePullRequestReviewUpdate(context, eventName, eventData);
  } else {
    throw new ClientError(`invalid event type: ${eventName}`);
  }
}

async function handlePullRequestUpdate(context, eventName, event) {
  const { action } = event;
  if (!RELEVANT_ACTIONS.includes(action)) {
    logger.info("Action ignored:", eventName, action);
    throw new NeutralExitError();
  }

  await updateAndMergePullRequest(context, event.pull_request);
}

async function handlePullRequestReviewUpdate(context, eventName, event) {
  const { action, review } = event;
  if (action === "submitted") {
    if (review.state === "approved") {
      await updateAndMergePullRequest(context, event.pull_request);
    } else {
      logger.info("Review state is not approved:", review.state);
      logger.info("Action ignored:", eventName, action);
      throw new NeutralExitError();
    }
  } else {
    logger.info("Action ignored:", eventName, action);
    throw new NeutralExitError();
  }
}

async function handleStatusUpdate(context, eventName, event) {
  const { state } = event;
  if (state !== "success") {
    logger.info("Event state ignored:", eventName, state);
    throw new NeutralExitError();
  }

  const { octokit } = context;

  for (const branch of event.branches) {
    logger.debug("Listing pull requests for", branch.name, "...");
    const { data: pullRequests } = await octokit.pulls.list({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      state: "open",
      head: `${event.repository.owner.login}:${branch.name}`,
      sort: "updated",
      direction: "desc",
      per_page: MAX_PR_COUNT
    });

    logger.trace("PR list:", pullRequests);

    let updated = 0;
    for (const pullRequest of pullRequests) {
      try {
        await updateAndMergePullRequest(context, pullRequest);
        ++updated;
      } catch (e) {
        if (e instanceof NeutralExitError) {
          logger.trace("PR update has been skipped.");
        } else {
          logger.error(e);
        }
      }
    }

    if (updated === 0) {
      logger.info("No PRs have been updated");
      throw new NeutralExitError();
    }
  }
}

async function updateAndMergePullRequest(context, pullRequest) {
  if (pullRequest.state !== "open") {
    logger.info("PR is not open:", pullRequest.state);
    throw new NeutralExitError();
  }

  if (skipPullRequest(context, pullRequest)) {
    throw new NeutralExitError();
  }

  const { token } = context;

  const repo = pullRequest.head.repo.full_name;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  const head = await tmpdir(path =>
    update(context, path, cloneUrl, pullRequest)
  );

  await merge(context, pullRequest, head);
}

async function handleBranchUpdate(context, eventName, event) {
  const { ref } = event;
  if (!ref.startsWith("refs/heads/")) {
    logger.info("Push does not reference a branch:", ref);
    throw new NeutralExitError();
  }

  const branch = ref.substr(11);
  logger.debug("Updated branch:", branch);

  const { octokit, token } = context;

  logger.debug("Listing pull requests...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner: event.repository.owner.name,
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
    throw new NeutralExitError();
  }

  const repo = `${event.repository.owner.name}/${event.repository.name}`;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  let updated = 0;

  for (const pullRequest of pullRequests) {
    if (skipPullRequest(context, pullRequest)) {
      continue;
    }

    try {
      await tmpdir(path => update(context, path, cloneUrl, pullRequest));
      updated++;
    } catch (e) {
      if (e instanceof NeutralExitError) {
        logger.trace("PR update has been skipped.");
      } else {
        logger.error(e);
      }
    }
  }

  if (updated > 0) {
    logger.info(updated, "PRs based on", branch, "have been updated");
  } else {
    logger.info("No PRs based on", branch, "have been updated");
    throw new NeutralExitError();
  }
}

function skipPullRequest(context, pullRequest) {
  const { config } = context;

  for (const label of pullRequest.labels) {
    if (config.labels.blocking.includes(label.name)) {
      logger.info("Skipping PR, blocking label present:", label.name);
      return true;
    }
  }

  const labels = pullRequest.labels.map(label => label.name);
  for (const required of config.labels.required) {
    if (!labels.includes(required)) {
      logger.info("Skipping PR, required label missing:", required);
      return true;
    }
  }

  return false;
}

module.exports = { executeLocally, executeGitHubAction };

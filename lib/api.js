const { ClientError, NeutralExitError, logger, tmpdir } = require("./common");
const { update } = require("./update");
const { merge } = require("./merge");

const URL_REGEXP = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/(pull|tree)\/([^ ]+)$/;

const RELEVANT_ACTIONS = ["labeled", "opened", "edited", "synchronize"];

// we'll only update a few PRs at once:
const MAX_PR_COUNT = 10;

async function executeLocally(octokit, url, token) {
  const m = url.match(URL_REGEXP);
  if (m && m[3] === "pull") {
    logger.debug("Getting PR data...");
    const { data: pull_request } = await octokit.pulls.get({
      owner: m[1],
      repo: m[2],
      number: m[4]
    });

    const event = {
      action: "opened",
      pull_request
    };

    await executeGitHubAction(octokit, token, "pull_request", event);
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

    await executeGitHubAction(octokit, token, "push", event);
  } else {
    throw new ClientError(`invalid URL: ${url}`);
  }
}

async function executeGitHubAction(octokit, token, eventName, eventData) {
  logger.info("Event name:", eventName);
  logger.trace("Event data:", eventData);

  if (eventName === "push") {
    await handleBranchUpdate(octokit, token, eventName, eventData);
  } else if (eventName === "status") {
    await handleStatusUpdate(octokit, token, eventName, eventData);
  } else if (eventName === "pull_request") {
    await handlePullRequestUpdate(octokit, token, eventName, eventData);
  } else if (eventName === "pull_request_review") {
    await handlePullRequestReviewUpdate(octokit, token, eventName, eventData);
  } else {
    throw new ClientError(`invalid event type: ${eventName}`);
  }
}

async function handlePullRequestUpdate(octokit, token, eventName, event) {
  const { action } = event;
  if (!RELEVANT_ACTIONS.includes(action)) {
    logger.info("Action ignored:", eventName, action);
    throw new NeutralExitError();
  }

  await updateAndMergePullRequest(octokit, token, event.pull_request);
}

async function handlePullRequestReviewUpdate(octokit, token, eventName, event) {
  const { action } = event;
  if (action === "submitted") {
    await updateAndMergePullRequest(octokit, token, event.pull_request);
  } else {
    logger.info("Action ignored:", eventName, action);
    throw new NeutralExitError();
  }
}

async function handleStatusUpdate(octokit, token, eventName, event) {
  const { state } = event;
  if (state !== "success") {
    logger.info("Event state ignored:", eventName, state);
    throw new NeutralExitError();
  }

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
        await updateAndMergePullRequest(octokit, token, pullRequest);
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

async function updateAndMergePullRequest(octokit, token, pullRequest) {
  if (pullRequest.state !== "open") {
    logger.info("PR is not open:", pullRequest.state);
    throw new NeutralExitError();
  }

  const repo = pullRequest.head.repo.full_name;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  const head = await tmpdir(path =>
    update(octokit, path, cloneUrl, pullRequest)
  );

  await merge(octokit, pullRequest, head);
}

async function handleBranchUpdate(octokit, token, eventName, event) {
  const { ref } = event;
  if (!ref.startsWith("refs/heads/")) {
    logger.info("Push does not reference a branch:", ref);
    throw new NeutralExitError();
  }

  const branch = ref.substr(11);
  logger.debug("Updated branch:", branch);

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
    try {
      await tmpdir(path => update(octokit, path, cloneUrl, pullRequest));
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

module.exports = { executeLocally, executeGitHubAction };

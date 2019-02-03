const { ClientError, NeutralExitError, logger, tmpdir } = require("./common");
const { update } = require("./update");
const { merge } = require("./merge");

const URL_REGEXP = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/(pull|tree)\/([^ ]+)$/;

async function executeLocally(octokit, url, token) {
  const m = url.match(URL_REGEXP);
  if (m && m[3] === "pull") {
    logger.debug("Getting PR data...");
    const { data: pullRequest } = await octokit.pulls.get({
      owner: m[1],
      repo: m[2],
      number: m[4]
    });

    await handlePullRequestUpdate(octokit, token, pullRequest);
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

    await handleBranchUpdate(octokit, token, event);
  } else {
    throw new ClientError(`invalid URL: ${url}`);
  }
}

async function executeGitHubAction(octokit, token, eventName, eventData) {
  logger.trace("Event name:", eventName);
  logger.trace("Event data:", eventData);

  if (eventName === "push") {
  } else if (eventName === "pull_request") {
    const pullRequest = eventData.pullRequest;
    await handlePullRequestUpdate(octokit, token, pullRequest);
  } else {
    throw new ClientError(`invalid event type: ${eventName}`);
  }
}

async function handlePullRequestUpdate(octokit, token, pullRequest) {
  logger.trace("PR:", pullRequest);

  const repo = pullRequest.head.repo.full_name;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  const head = await tmpdir(path =>
    update(octokit, path, cloneUrl, pullRequest)
  );

  await merge(octokit, pullRequest, head);
}

async function handleBranchUpdate(octokit, token, event) {
  logger.trace("Event:", event);

  const { ref } = event;
  if (!ref.startsWith("refs/heads/")) {
    logger.info("Push does not reference a branch:", ref);
    throw new NeutralExitError();
  }

  const branch = ref.substr(11);
  logger.debug("Updated branch:", branch);

  // let's only update a few PRs at once:
  const max = 10;

  logger.debug("Listing pull requests...");
  const { data: pullRequests } = await octokit.pulls.list({
    owner: event.repository.owner.name,
    repo: event.repository.name,
    state: "open",
    base: branch,
    sort: "updated",
    direction: "desc",
    per_page: max
  });

  logger.info("Open PRs:", pullRequests.length);

  const repo = `${event.repository.owner.name}/${event.repository.name}`;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  for (const pullRequest of pullRequests) {
    // when using pulls.list, some data is missing, so we need to fetch it:
    logger.debug("Getting pull request info for", pullRequest.number, "...");
    const { data: fullPullRequest } = await octokit.pulls.get({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      number: pullRequest.number
    });

    logger.trace("PR:", fullPullRequest);

    try {
      await tmpdir(path => update(octokit, path, cloneUrl, fullPullRequest));
    } catch (e) {
      if (e instanceof NeutralExitError) {
        logger.trace("PR update has been skipped.");
      } else {
        logger.error(e);
      }
    }
  }

  logger.info("PRs based on", branch, "have been updated");
}

module.exports = { executeLocally, executeGitHubAction };

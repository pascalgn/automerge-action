const { ClientError, NeutralExitError, logger, tmpdir } = require("./common");
const { update } = require("./update");

const URL_REGEXP = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/pull\/([0-9]+)$/;

async function updateLocalInvocation(octokit, url, token) {
  const m = url.match(URL_REGEXP);
  if (!m) {
    throw new ClientError(`Invalid URL: ${url}`);
  }

  logger.debug("Getting PR data...");
  const pullRequestId = { owner: m[1], repo: m[2], number: m[3] };
  const { data: pullRequest } = await octokit.pulls.get({ ...pullRequestId });

  logger.trace("PR:", pullRequest);

  const repo = pullRequest.head.repo.full_name;
  const cloneUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

  await tmpdir(path => update(octokit, path, cloneUrl, pullRequest));
}

async function updateGitHubAction(octokit, pullRequest) {}

module.exports = { updateLocalInvocation, updateGitHubAction };

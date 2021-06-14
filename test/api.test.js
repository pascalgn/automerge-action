const api = require("../lib/api");
const { createConfig } = require("../lib/common");
const { pullRequest } = require("./common");

let octokit;

test("forked PR check_suite/check_run updates are handled", async () => {
  // GIVEN
  const head_sha = "1234abcd";
  const pr = pullRequest();
  pr.labels = [{ name: "automerge" }];
  pr.head.sha = head_sha;

  const config = createConfig({});

  let merged = false;
  octokit = {
    pulls: {
      list: jest.fn(() => ({ data: [pr] })),
      merge: jest.fn(() => (merged = true)),
      listReviews: jest.fn(() => ({ data: [] }))
    }
  };

  const event = {
    action: "completed",
    repository: { owner: { login: "other-username" }, name: "repository" },
    check_suite: { conclusion: "success", head_sha, pull_requests: [] }
  };

  // WHEN
  await api.executeGitHubAction({ config, octokit }, "check_suite", event);
  expect(merged).toEqual(true);
});

test("only merge PRs with required approvals", async () => {
  // GIVEN
  const head_sha = "1234abcd";
  const pr = pullRequest();
  pr.labels = [{ name: "automerge" }];
  pr.head.sha = head_sha;

  const config = createConfig({});
  config.mergeRequiredApprovals = 1;

  let merged = false;
  octokit = {
    pulls: {
      list: jest.fn(() => ({ data: [pr] })),
      merge: jest.fn(() => (merged = true)),
      listReviews: jest.fn(() => ({ data: [] }))
    }
  };

  const event = {
    action: "completed",
    repository: { owner: { login: "other-username" }, name: "repository" },
    check_suite: { conclusion: "success", head_sha, pull_requests: [] }
  };

  // WHEN
  await api.executeGitHubAction({ config, octokit }, "check_suite", event);
  expect(merged).toEqual(false);

  merged = false;
  octokit.pulls.listReviews.mockReturnValueOnce({
    data: [{ state: "APPROVED", user: { login: "approval_user" } }]
  });

  // WHEN
  await api.executeGitHubAction({ config, octokit }, "check_suite", event);
  expect(merged).toEqual(true);
});

const { merge } = require("../lib/merge");
const { createConfig } = require("../lib/common");
const { pullRequest, reviews } = require("./common");

let octokit;

beforeEach(() => {
  octokit = {
    pulls: {
      merge: jest.fn()
    }
  };
});

test("MERGE_COMMIT_MESSAGE_REGEX can be used to cut PR body", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.body = [
    "PSA: This is the meaty part of the PR body.",
    "It also matches newlines.",
    "",
    "----",
    "",
    "Here is a silly license agreement."
  ].join("\n");

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description",
    MERGE_COMMIT_MESSAGE_REGEX: "PSA:(.*)^----"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);

  // THEN
  expect(octokit.pulls.merge).toHaveBeenCalledWith(
    expect.objectContaining({
      commit_title:
        "Update README\n\nThis is the meaty part of the PR body.\nIt also matches newlines.",
      commit_message: "",
      pull_number: 1,
      repo: "repository",
      sha: "2c3b4d5"
    })
  );
});

test("Throw if MERGE_COMMIT_MESSAGE_REGEX is invalid", async () => {
  // GIVEN
  const pr = pullRequest();
  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description",
    MERGE_COMMIT_MESSAGE_REGEX: ".*"
  });

  // WHEN
  expect(merge({ config, octokit }, pr)).rejects.toThrow("capturing subgroup");
});

test("MERGE_FILTER_AUTHOR can be used to auto merge based on author", async () => {
  // GIVEN
  const pr = pullRequest();
  const author = "minime";
  const user = {
    login: author
  };
  pr.user = user;

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description",
    MERGE_FILTER_AUTHOR: author
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
});

test("MERGE_APROOVED_BY_REVIEWERS can be used to auto merge based on requested reviewers", async () => {
  // GIVEN
  const pr = pullRequest();
  const reviewsMock = reviews();
  const reviewers = "test, minime";

  const config = createConfig({
    MERGE_APROOVED_BY_REVIEWERS: reviewers,
  });

  // WHEN
  expect(await merge({ config, octokit }, pr, reviewsMock)).toEqual(true);

  // GIVEN
  const configWithNotApprovedReviwers = createConfig({
    MERGE_APROOVED_BY_REVIEWERS: "minime_fake, test, fake",
  });

  // WHEN
  expect(await merge({ config: configWithNotApprovedReviwers, octokit }, pr, reviewsMock)).toEqual(false);
});

test("MERGE_APROOVED_BY_REVIEWERS doesn't affect other checks", async () => {
  // GIVEN
  const pr = pullRequest();
  const reviewsMock = reviews();
  const reviewers = "test, minime, test2";

  const config = createConfig({
    MERGE_LABELS: 'SHOULD_FAIL',
    MERGE_APROOVED_BY_REVIEWERS: reviewers,
  });

  // WHEN
  expect(await merge({ config, octokit }, pr, reviewsMock)).toEqual(false);
});

test("MERGE_FILTER_AUTHOR when not set should not affect anything", async () => {
  // GIVEN
  const pr = pullRequest();
  const author = "minime";
  const user = {
    login: author
  };
  pr.user = user;

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
});

test("MERGE_FILTER_AUTHOR when set but do not match current author should not merge", async () => {
  // GIVEN
  const pr = pullRequest();
  const author = "notminime";
  const user = {
    login: author
  };
  pr.user = user;

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description",
    MERGE_FILTER_AUTHOR: "minime"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(false);
});

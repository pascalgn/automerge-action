const { merge } = require("../lib/merge");
const { createConfig } = require("../lib/common");
const { pullRequest } = require("./common");

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

test("MERGE_COMMIT_MESSAGE_EXCLUDE_REGEX can be used to transform PR body", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.body = [
    "PSA: This is the meaty part of the PR body.",
    "It also matches newlines.",
    "",
    "<!-- Please don't render my -->",
    "this is important",
    "<!-- comments, even if they are",
    "multiline -->",
    "This is also important"
  ].join("\n");

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "pull-request-title-and-description",
    MERGE_COMMIT_MESSAGE_EXCLUDE_REGEX: "<!--[\\s\\S]*?(?:-->)?<!---+>?|<!(?![dD][oO][cC][tT][yY][pP][eE]|\\[CDATA\\[)[^>]*>?|<[?][^>]*>?"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);

  // THEN
  expect(octokit.pulls.merge).toHaveBeenCalledWith(
    expect.objectContaining({
      commit_title:
        "Update README\n\nPSA: This is the meaty part of the PR body.\nIt also matches newlines.\n\n\nthis is important\n\nThis is also important",
      commit_message: "",
      pull_number: 1,
      repo: "repository",
      sha: "2c3b4d5"
    })
  );
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

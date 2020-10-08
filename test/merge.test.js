const { merge } = require("../lib/merge");
const { createConfig } = require("../lib/common");
const { pullRequest } = require("./common");

let octokit, mergeMethod;

beforeEach(() => {
  mergeMethod = undefined;
  octokit = {
    pulls: {
      merge: jest.fn(({ merge_method }) => (mergeMethod = merge_method))
    }
  };
});

test("MERGE_COMMIT_MESSAGE with nested custom fields", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.title = "This is the PR's title";
  pr.user = { login: "author" };

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: "{pullRequest.title} @{pullRequest.user.login}"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);

  // THEN
  expect(octokit.pulls.merge).toHaveBeenCalledWith(
    expect.objectContaining({
      commit_title: "This is the PR's title @author",
      commit_message: "",
      pull_number: 1,
      repo: "repository",
      sha: "2c3b4d5"
    })
  );
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

test("Merge method can be set by env variable", async () => {
  // GIVEN
  const pr = pullRequest();

  const config = createConfig({
    MERGE_METHOD: "rebase"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
  expect(mergeMethod).toEqual("rebase");
});

test("Merge method can be set by a merge method label", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "autosquash" }, { name: "reallyautomerge" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD: "merge",
    MERGE_LABELS: "reallyautomerge"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
  expect(mergeMethod).toEqual("squash");
});

test("Merge method can be required", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "autosquash" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "true",
    MERGE_METHOD: "merge",
    MERGE_LABELS: ""
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
  expect(mergeMethod).toEqual("squash");
});

test("Missing require merge method skips PR", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "mergeme" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "true",
    MERGE_METHOD: "merge",
    MERGE_LABELS: "mergeme"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(false);
});

test("Merge method doesn't have to be required", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "mergeme" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "false",
    MERGE_METHOD: "merge",
    MERGE_LABELS: "mergeme"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);
  expect(mergeMethod).toEqual("merge");
});

test("Multiple merge method labels throw an error", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "automerge" }, { name: "autosquash" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "true",
    MERGE_METHOD: "merge"
  });

  // WHEN
  expect(merge({ config, octokit }, pr)).rejects.toThrow("merge method labels");
});

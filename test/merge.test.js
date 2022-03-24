const { merge } = require("../lib/merge");
const { createConfig } = require("../lib/common");
const { pullRequest } = require("./common");

let octokit, mergeMethod;

beforeEach(() => {
  mergeMethod = undefined;
  octokit = {
    pulls: {
      merge: jest.fn(({ merge_method }) => (mergeMethod = merge_method)),
      get: () => {}
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");

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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");

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
  expect(merge({ config, octokit }, pr, 0)).rejects.toThrow(
    "capturing subgroup"
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(await merge({ config, octokit }, pr)).toEqual("author_filtered");
});

test("Merge method can be set by env variable", async () => {
  // GIVEN
  const pr = pullRequest();

  const config = createConfig({
    MERGE_METHOD: "rebase"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(await merge({ config, octokit }, pr)).toEqual("skipped");
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
  expect(await merge({ config, octokit }, pr)).toEqual("merged");
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
  expect(merge({ config, octokit }, pr, 0)).rejects.toThrow(
    "merge method labels"
  );
});

test("Base branch is listed then PR is merged", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "mergeme" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "false",
    MERGE_METHOD: "merge",
    MERGE_LABELS: "mergeme",
    BASE_BRANCHES: "main,master,dev"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr, 0)).toEqual("merged");
});

test("Base branch not listed then PR is skipped", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.labels = [{ name: "mergeme" }];

  const config = createConfig({
    MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash,autorebase=rebase",
    MERGE_METHOD_LABEL_REQUIRED: "false",
    MERGE_METHOD: "merge",
    MERGE_LABELS: "mergeme",
    BASE_BRANCHES: "main,dev"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr, 0)).toEqual("skipped");
});

test("Unmergeable pull request fails action with non-zero exit code", async () => {
  // GIVEN
  const pr = pullRequest();
  pr.mergeable_state = "blocked";
  const config = createConfig();
  octokit.pulls.get = async () => ({ data: pr });

  // Reduce retry wait period to 1ms to prevent test timeout
  config.mergeRetrySleep = 1;

  // WHEN
  const mockExit = jest
    .spyOn(process, "exit")
    .mockImplementationOnce(statusCode => {
      throw new Error(
        `process.exit was called with status code: ${statusCode}`
      );
    });
  try {
    await merge({ config, octokit }, pr, 0);
  } catch (e) {
    expect(e).toEqual(new Error("process.exit was called with status code: 1"));
    expect(mockExit).toHaveBeenCalledWith(1);
  }
});

const { merge } = require("../lib/merge");
const { logger, createConfig } = require("../lib/common");
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
    'PSA: This is the meaty part of the PR body.',
    'It also matches newlines.',
    '',
    '----',
    '',
    'Here is a silly license agreement.',
  ].join('\n');

  const config = createConfig({
    MERGE_COMMIT_MESSAGE: 'pull-request-title-and-description',
    MERGE_COMMIT_MESSAGE_REGEX: "PSA:(.*)^----"
  });

  // WHEN
  expect(await merge({ config, octokit }, pr)).toEqual(true);

  // THEN
  expect(octokit.pulls.merge).toHaveBeenCalledWith(expect.objectContaining({
    "commit_message": 'Update README\n\nThis is the meaty part of the PR body.\nIt also matches newlines.',
    "pull_number": 1,
    "repo": "repository",
    "sha": "2c3b4d5",
  }));
});

test("Throw if MERGE_COMMIT_MESSAGE_REGEX is invalid", async () => {
  // GIVEN
  const pr = pullRequest();
  const config = createConfig({
    MERGE_COMMIT_MESSAGE: 'pull-request-title-and-description',
    MERGE_COMMIT_MESSAGE_REGEX: ".*"
  });

  // WHEN
  expect(merge({ config, octokit }, pr)).rejects.toThrow('capturing subgroup');
});
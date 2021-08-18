const { createConfig } = require("../lib/common");

test("createConfig", () => {
  const config = createConfig({
    UPDATE_LABELS: " required1,! block1, ! ,required2, !block2 ",
    MERGE_LABELS: "",
    MERGE_RETRIES: "3",
    BASE_BRANCHES: "dev,main"
  });
  const expected = {
    mergeMethod: "merge",
    mergeFilterAuthor: "",
    mergeLabels: {
      blocking: [],
      required: []
    },
    mergeMethodLabels: [],
    mergeMethodLabelRequired: false,
    mergeForks: true,
    mergeCommitMessage: "automatic",
    mergeCommitMessageRegex: "",
    mergeDeleteBranch: false,
    mergeDeleteBranchFilter: [],
    mergeRetries: 3,
    mergeRetrySleep: 5000,
    mergeRequiredApprovals: 0,
    mergeRemoveLabels: [],
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    updateRetries: 1,
    updateRetrySleep: 5000,
    baseBranches: ["dev", "main"],
    pullRequest: null
  };
  expect(config).toEqual(expected);
});

test("createConfig with arbitrary pull request (as string)", () => {
  const config = createConfig({
    UPDATE_LABELS: " required1,! block1, ! ,required2, !block2 ",
    MERGE_LABELS: "",
    MERGE_RETRIES: "3",
    PULL_REQUEST: "144"
  });
  const expected = {
    mergeMethod: "merge",
    mergeFilterAuthor: "",
    mergeLabels: {
      blocking: [],
      required: []
    },
    mergeMethodLabels: [],
    mergeMethodLabelRequired: false,
    mergeForks: true,
    mergeCommitMessage: "automatic",
    mergeCommitMessageRegex: "",
    mergeDeleteBranch: false,
    mergeDeleteBranchFilter: [],
    mergeRetries: 3,
    mergeRetrySleep: 5000,
    mergeRequiredApprovals: 0,
    mergeRemoveLabels: [],
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    updateRetries: 1,
    updateRetrySleep: 5000,
    baseBranches: [],
    pullRequest: {
      pullRequestNumber: 144
    }
  };
  expect(config).toEqual(expected);
});

test("createConfig with arbitrary pull request (as number)", () => {
  const config = createConfig({
    UPDATE_LABELS: " required1,! block1, ! ,required2, !block2 ",
    MERGE_LABELS: "",
    MERGE_RETRIES: "3",
    PULL_REQUEST: 144
  });
  const expected = {
    mergeMethod: "merge",
    mergeFilterAuthor: "",
    mergeLabels: {
      blocking: [],
      required: []
    },
    mergeMethodLabels: [],
    mergeMethodLabelRequired: false,
    mergeForks: true,
    mergeCommitMessage: "automatic",
    mergeCommitMessageRegex: "",
    mergeDeleteBranch: false,
    mergeDeleteBranchFilter: [],
    mergeRetries: 3,
    mergeRetrySleep: 5000,
    mergeRequiredApprovals: 0,
    mergeRemoveLabels: [],
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    updateRetries: 1,
    updateRetrySleep: 5000,
    baseBranches: [],
    pullRequest: {
      pullRequestNumber: 144
    }
  };
  expect(config).toEqual(expected);
});

test("createConfig with arbitrary pull request in another repo", () => {
  const config = createConfig({
    UPDATE_LABELS: " required1,! block1, ! ,required2, !block2 ",
    MERGE_LABELS: "",
    MERGE_RETRIES: "3",
    PULL_REQUEST: "pascalgn/automerge-action/144"
  });
  const expected = {
    mergeMethod: "merge",
    mergeFilterAuthor: "",
    mergeLabels: {
      blocking: [],
      required: []
    },
    mergeMethodLabels: [],
    mergeMethodLabelRequired: false,
    mergeForks: true,
    mergeCommitMessage: "automatic",
    mergeCommitMessageRegex: "",
    mergeDeleteBranch: false,
    mergeDeleteBranchFilter: [],
    mergeRetries: 3,
    mergeRetrySleep: 5000,
    mergeRequiredApprovals: 0,
    mergeRemoveLabels: [],
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    updateRetries: 1,
    updateRetrySleep: 5000,
    baseBranches: [],
    pullRequest: {
      repoOwner: "pascalgn",
      repoName: "automerge-action",
      pullRequestNumber: 144
    }
  };
  expect(config).toEqual(expected);
});

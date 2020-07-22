const { createConfig } = require("../lib/common");

test("createConfig", () => {
  const config = createConfig({
    UPDATE_LABELS: " required1,! block1, ! ,required2, !block2 ",
    MERGE_LABELS: "",
    MERGE_RETRIES: "3"
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
    mergeRetries: 3,
    mergeRetrySleep: 5000,
    mergeRemoveLabels: [""],
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    updateRetries: 1,
    updateRetrySleep: 5000
  };
  expect(config).toEqual(expected);
});

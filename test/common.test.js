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
    mergeForks: true,
    mergeCommitMessage: "automatic",
    mergeCommitMessageRegex: "",
    mergeDeleteBranch: false,
    mergeRetries: 3,
    mergeRetrySleep: 10000,
    updateMethod: "merge",
    updateLabels: {
      blocking: ["block1", "block2"],
      required: ["required1", "required2"]
    },
    mergeRemoveLabels: [""]
  };
  expect(config).toEqual(expected);
});

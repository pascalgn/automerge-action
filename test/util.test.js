const { branchName } = require("../lib/util");

describe("branchName", () => {
  it("returns the branch name from a reference referring to a branch", async () => {
    expect(branchName("refs/heads/main")).toEqual("main");
    expect(branchName("refs/heads/features/branch_with_slashes")).toEqual(
      "features/branch_with_slashes"
    );
  });

  it("is falsey for other kinds of git references", async () => {
    expect(branchName("refs/tags/v1.0")).toBeUndefined();
    expect(branchName("refs/remotes/origin/main")).toBeUndefined();
  });
});

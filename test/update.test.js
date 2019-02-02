const fse = require("fs-extra");

const git = require("../lib/git");
const { NeutralExitError } = require("../lib/common");
const { update, earliestDate } = require("../lib/update");
const { tmpdir, pullRequest } = require("./common");

async function init(dir) {
  await fse.mkdirs(dir);
  await git.git(dir, "init");
  await git.git(dir, "commit", "--allow-empty", "-m", "Commit 1");
  await git.git(dir, "commit", "--allow-empty", "-m", "Commit 2");
}

test("update will only change branches from the same repository", async () => {
  const pr = pullRequest();
  pr.head.repo.full_name = "other/repository";
  await expect(update(null, "", "", pr)).rejects.toEqual(
    new NeutralExitError()
  );
});

test("earliestDate will return null", () => {
  expect(earliestDate()).toBe(null);
});

test("earliestDate will return earliest date", () => {
  const commits = [
    {
      sha: "2b3c4d00",
      committer: { name: "GitHub", date: "2018-11-08T15:56:43Z" }
    },
    {
      sha: "9b3c4d00",
      committer: { name: "GitHub", date: "2018-11-08T15:56:02Z" }
    }
  ];
  expect(earliestDate(commits)).toBe("2018-11-08T15:56:02Z");
});

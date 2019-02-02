const fse = require("fs-extra");

const git = require("../lib/git");
const { tmpdir } = require("../lib/common");

async function init(dir) {
  await fse.mkdirs(dir);
  await git.git(dir, "init");
  await git.git(dir, "commit", "--allow-empty", "-m", "Commit 1");
  await git.git(dir, "commit", "--allow-empty", "-m", "Commit 2");
}

test("clone", async () => {
  await tmpdir(async path => {
    await init(`${path}/origin`);
    await git.clone(`file://${path}/origin`, `${path}/ws`, "master", 1);
    expect(await fse.exists(`${path}/ws`)).toBe(true);
  });
});

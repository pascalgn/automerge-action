const fse = require("fs-extra");

const git = require("../lib/git");
const { tmpdir } = require("../lib/common");

async function init(dir) {
  await fse.mkdirs(dir);
  await git.git(dir, "init");
}

async function commit(dir, message = "C%d", count = 1) {
  for (let i = 1; i <= count; i++) {
    await git.git(
      dir,
      "commit",
      "--allow-empty",
      "-m",
      message.replace(/%d/g, i)
    );
  }
}

test("clone creates the target directory", async () => {
  await tmpdir(async path => {
    await init(`${path}/origin`);
    await commit(`${path}/origin`);
    await git.clone(`file://${path}/origin`, `${path}/ws`, "master", 1);
    expect(await fse.exists(`${path}/ws`)).toBe(true);
  });
});

test("fetchUntilMergeBase finds the correct merge base", async () => {
  await tmpdir(async path => {
    const origin = `${path}/origin`;
    await init(origin);
    await commit(origin, "base %d", 10);
    const base = await git.head(origin);
    await git.git(origin, "checkout", "-b", "br1");
    await commit(origin, "br1 %d", 20);
    await git.git(origin, "checkout", "master");
    await commit(origin, "master %d", 20);

    const ws = `${path}/ws`;
    await git.clone(`file://${path}/origin`, ws, "br1");
    await git.fetch(ws, "master");
    expect(await git.fetchUntilMergeBase(ws, "master", 10000)).toBe(base);
  });
}, 15000);

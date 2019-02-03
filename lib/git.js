const { spawn } = require("child_process");

const { logger } = require("./common");

function git(cwd, ...args) {
  const stdio = [
    "ignore",
    "pipe",
    logger.level === "trace" || logger.level === "debug" ? "inherit" : "ignore"
  ];
  // the URL passed to the clone command could contain a password!
  const command = args.includes("clone")
    ? "git clone"
    : `git ${args.join(" ")}`;
  logger.debug("Executing", command);
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args.filter(a => a !== null), { cwd, stdio });
    const buffers = [];
    proc.stdout.on("data", data => buffers.push(data));
    proc.on("error", () => {
      reject(new Error(`command failed: ${command}`));
    });
    proc.on("exit", code => {
      if (code === 0) {
        const data = Buffer.concat(buffers);
        resolve(data.toString("utf8").trim());
      } else {
        reject(new Error(`command failed with code ${code}: ${command}`));
      }
    });
  });
}

async function clone(from, to, branch, depth) {
  await git(
    ".",
    "clone",
    "--quiet",
    "--shallow-submodules",
    "--no-tags",
    "--branch",
    branch,
    "--depth",
    `${depth}`,
    from,
    to
  );
}

async function fetchHead(dir, branch) {
  await git(
    dir,
    "fetch",
    "--quiet",
    "--depth",
    "1",
    "origin",
    `${branch}:refs/remotes/origin/${branch}`
  );
}

async function fetchSince(dir, branch, date) {
  await git(
    dir,
    "fetch",
    "--quiet",
    "--shallow-since",
    date,
    "origin",
    `${branch}:refs/remotes/origin/${branch}`
  );
}

async function head(dir) {
  return await git(dir, "show-ref", "--head", "-s", "/HEAD");
}

async function sha(dir, branch) {
  return await git(dir, "show-ref", "-s", `refs/remotes/origin/${branch}`);
}

async function rebase(dir, branch) {
  return await git(dir, "rebase", "--quiet", "--autosquash", branch);
}

async function push(dir, force, branch) {
  return await git(
    dir,
    "push",
    "--quiet",
    force ? "--force-with-lease" : null,
    "origin",
    branch
  );
}

module.exports = {
  git,
  clone,
  fetchHead,
  fetchSince,
  head,
  sha,
  rebase,
  push
};

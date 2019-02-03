const { spawn } = require("child_process");

const { TimeoutError, logger } = require("./common");

class ExitError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const FETCH_DEPTH = 10;

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
        reject(
          new ExitError(`command failed with code ${code}: ${command}`, code)
        );
      }
    });
  });
}

async function clone(from, to, branch) {
  await git(
    ".",
    "clone",
    "--quiet",
    "--shallow-submodules",
    "--no-tags",
    "--branch",
    branch,
    "--depth",
    FETCH_DEPTH,
    from,
    to
  );
}

async function fetch(dir, branch) {
  await git(
    dir,
    "fetch",
    "--quiet",
    "--depth",
    FETCH_DEPTH,
    "origin",
    `${branch}:refs/remotes/origin/${branch}`
  );
}

async function fetchUntilMergeBase(dir, branch, timeout) {
  const maxTime = new Date().getTime() + timeout;
  while (new Date().getTime() < maxTime) {
    const base = await mergeBase(dir, branch);
    if (base) {
      return base;
    }
    await fetchDeepen(dir);
  }
  throw new TimeoutError();
}

async function fetchDeepen(dir) {
  await git(dir, "fetch", "--quiet", "--deepen", FETCH_DEPTH);
}

async function mergeBase(dir, branch) {
  try {
    return await git(
      dir,
      "merge-base",
      "HEAD",
      `refs/remotes/origin/${branch}`
    );
  } catch (e) {
    if (e instanceof ExitError && e.code === 1) {
      return null;
    } else {
      throw e;
    }
  }
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
  ExitError,
  git,
  clone,
  fetch,
  fetchUntilMergeBase,
  fetchDeepen,
  mergeBase,
  head,
  sha,
  rebase,
  push
};

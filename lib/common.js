const util = require("util");
const process = require("process");
const fse = require("fs-extra");
const tmp = require("tmp");

const RESULT_SKIPPED = "skipped";
const RESULT_NOT_READY = "not_ready";
const RESULT_AUTHOR_FILTERED = "author_filtered";
const RESULT_MERGE_FAILED = "merge_failed";
const RESULT_MERGED = "merged";

class ClientError extends Error {}

class TimeoutError extends Error {}

function log(prefix, obj) {
  if (process.env.NODE_ENV !== "test") {
    const now = new Date().toISOString();
    const str = obj.map(o => (typeof o === "object" ? inspect(o) : o));
    if (prefix) {
      console.log.apply(console, [now, prefix, ...str]);
    } else {
      console.log.apply(console, [now, ...str]);
    }
  }
}

const logger = {
  level: "info",

  trace: (...str) => {
    if (logger.level === "trace") {
      log("TRACE", str);
    }
  },

  debug: (...str) => {
    if (logger.level === "trace" || logger.level === "debug") {
      log("DEBUG", str);
    }
  },

  info: (...str) => log("INFO ", str),

  error: (...str) => {
    if (str.length === 1 && str[0] instanceof Error) {
      if (logger.level === "trace" || logger.level === "debug") {
        log(null, [str[0].stack || str[0]]);
      } else {
        log("ERROR", [str[0].message || str[0]]);
      }
    } else {
      log("ERROR", str);
    }
  }
};

function inspect(obj) {
  return util.inspect(obj, false, null, true);
}

function createConfig(env = {}) {
  function parseMergeLabels(str, defaultValue) {
    const arr = (str == null ? defaultValue : str)
      .split(",")
      .map(s => s.trim());
    return {
      required: arr.filter(s => !s.startsWith("!") && s.length > 0),
      blocking: arr
        .filter(s => s.startsWith("!"))
        .map(s => s.substr(1).trim())
        .filter(s => s.length > 0)
    };
  }

  function parseLabelMethods(str) {
    return (str ? str.split(",") : []).map(lm => {
      const [label, method] = lm.split("=");
      if (!label || !method) {
        throw new Error(
          `Couldn't parse "${lm}" as "<label>=<method>" expression`
        );
      }
      return { label, method };
    });
  }

  function parseArray(str) {
    return str ? str.split(",") : [];
  }

  function parseBranches(str, defaultValue) {
    return (str == null ? defaultValue : str)
      .split(",")
      .map(s => s.trim())
      .filter(s => s);
  }

  function parsePositiveInt(name, defaultValue) {
    const val = env[name];
    if (val == null || val === "") {
      return defaultValue;
    } else {
      const number = parseInt(val, 10);
      if (isNaN(number) || number < 0) {
        throw new ClientError(`Not a positive integer: ${val}`);
      } else {
        return number;
      }
    }
  }

  function parsePullRequest(pullRequest) {
    if (!pullRequest) {
      return null;
    }

    logger.info(`Parsing PULL_REQUEST input: ${pullRequest}`);

    const error = new ClientError(
      `Invalid value provided for input PULL_REQUEST: ${pullRequest}. Must be a positive integer, optionally prefixed by a repo slug.`
    );

    if (typeof pullRequest === "string") {
      let repoOwner;
      let repoName;
      let pullRequestNumber;

      const destructuredPullRequest = pullRequest.split("/");
      if (destructuredPullRequest.length === 3) {
        [repoOwner, repoName, pullRequestNumber] = destructuredPullRequest;
      } else if (destructuredPullRequest.length === 1) {
        [pullRequestNumber] = destructuredPullRequest;
      } else {
        throw error;
      }

      pullRequestNumber = parseInt(pullRequestNumber, 10);
      if (isNaN(pullRequestNumber) || pullRequestNumber <= 0) {
        throw error;
      }

      return {
        repoOwner,
        repoName,
        pullRequestNumber
      };
    }

    if (typeof pullRequest === "number" && pullRequest > 0) {
      return { pullRequestNumber: pullRequest };
    }

    throw error;
  }

  const mergeLabels = parseMergeLabels(env.MERGE_LABELS, "automerge");
  const mergeRemoveLabels = parseArray(env.MERGE_REMOVE_LABELS);
  const mergeMethod = env.MERGE_METHOD || "merge";
  const mergeForks = env.MERGE_FORKS !== "false";
  const mergeCommitMessage = env.MERGE_COMMIT_MESSAGE || "automatic";
  const mergeCommitMessageRegex = env.MERGE_COMMIT_MESSAGE_REGEX || "";
  const mergeFilterAuthor = env.MERGE_FILTER_AUTHOR || "";
  const mergeRetries = parsePositiveInt("MERGE_RETRIES", 6);
  const mergeRetrySleep = parsePositiveInt("MERGE_RETRY_SLEEP", 5000);
  const mergeRequiredApprovals = parsePositiveInt(
    "MERGE_REQUIRED_APPROVALS",
    0
  );
  const mergeDeleteBranch = env.MERGE_DELETE_BRANCH === "true";
  const mergeDeleteBranchFilter = parseArray(env.MERGE_DELETE_BRANCH_FILTER);
  const mergeMethodLabels = parseLabelMethods(env.MERGE_METHOD_LABELS);
  const mergeMethodLabelRequired = env.MERGE_METHOD_LABEL_REQUIRED === "true";
  const mergeErrorFail = env.MERGE_ERROR_FAIL === "true";

  const updateLabels = parseMergeLabels(env.UPDATE_LABELS, "automerge");
  const updateMethod = env.UPDATE_METHOD || "merge";
  const updateRetries = parsePositiveInt("UPDATE_RETRIES", 1);
  const updateRetrySleep = parsePositiveInt("UPDATE_RETRY_SLEEP", 5000);

  const baseBranches = parseBranches(env.BASE_BRANCHES, "");

  const pullRequest = parsePullRequest(env.PULL_REQUEST);

  return {
    mergeLabels,
    mergeRemoveLabels,
    mergeMethod,
    mergeMethodLabels,
    mergeMethodLabelRequired,
    mergeForks,
    mergeCommitMessage,
    mergeCommitMessageRegex,
    mergeFilterAuthor,
    mergeRetries,
    mergeRetrySleep,
    mergeRequiredApprovals,
    mergeDeleteBranch,
    mergeDeleteBranchFilter,
    mergeErrorFail,
    updateLabels,
    updateMethod,
    updateRetries,
    updateRetrySleep,
    baseBranches,
    pullRequest
  };
}

function tmpdir(callback) {
  async function handle(path) {
    try {
      return await callback(path);
    } finally {
      await fse.remove(path);
    }
  }

  return new Promise((resolve, reject) => {
    tmp.dir((err, path) => {
      if (err) {
        reject(err);
      } else {
        handle(path).then(resolve, reject);
      }
    });
  });
}

async function retry(retries, retrySleep, doInitial, doRetry, doFailed) {
  const initialResult = await doInitial();
  if (initialResult === "success") {
    return true;
  } else if (initialResult === "failure") {
    return false;
  } else if (initialResult !== "retry") {
    throw new Error(`invalid return value: ${initialResult}`);
  }

  for (let run = 1; run <= retries; run++) {
    if (retrySleep === 0) {
      logger.info(`Retrying ... (${run}/${retries})`);
    } else {
      logger.info(`Retrying after ${retrySleep} ms ... (${run}/${retries})`);
      await sleep(retrySleep);
    }

    const retryResult = await doRetry();
    if (retryResult === "success") {
      return true;
    } else if (retryResult === "failure") {
      return false;
    } else if (retryResult !== "retry") {
      throw new Error(`invalid return value: ${initialResult}`);
    }
  }

  await doFailed();
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  ClientError,
  TimeoutError,
  logger,
  createConfig,
  tmpdir,
  inspect,
  retry,
  sleep,
  RESULT_SKIPPED,
  RESULT_NOT_READY,
  RESULT_AUTHOR_FILTERED,
  RESULT_MERGE_FAILED,
  RESULT_MERGED
};

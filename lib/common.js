const util = require("util");
const process = require("process");

const fse = require("fs-extra");
const tmp = require("tmp");

class ClientError extends Error {}

class TimeoutError extends Error {}

function log(prefix, obj) {
  if (process.env.NODE_ENV !== "test") {
    const str = obj.map(o => (typeof o === "object" ? inspect(o) : o));
    if (prefix) {
      console.log.apply(console, [prefix, ...str]);
    } else {
      console.log.apply(console, str);
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
    if (str.length === 1) {
      if (str[0] instanceof Error) {
        if (logger.level === "trace" || logger.level === "debug") {
          log(null, [str[0].stack || str[0]]);
        } else {
          log("ERROR", [str[0].message || str[0]]);
        }
      }
    } else {
      log("ERROR", str);
    }
  }
};

function inspect(obj) {
  return util.inspect(obj, false, null, true);
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

async function retry(retries, sleep, doInitial, doRetry, doFailed) {
  if (await doInitial()) {
    return true;
  }

  for (let run = 1; run <= retries; run++) {
    logger.info(`Retrying after ${sleep} ms ... (${run}/${retries})`);
    await doSleep(sleep);

    if (await doRetry()) {
      return true;
    }
  }

  await doFailed();
  return false;
}

function doSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  ClientError,
  TimeoutError,
  logger,
  tmpdir,
  inspect,
  retry
};

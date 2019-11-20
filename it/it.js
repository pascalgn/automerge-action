const Octokit = require("@octokit/rest");

const { executeLocally } = require("../lib/api");

async function main() {
  require("dotenv").config();

  const token = process.env.GITHUB_TOKEN;

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action-it"
  });

  const mergeLabels = { required: ["it-merge"], blocking: [] };
  const mergeMethod = "merge";
  const mergeForks = false;
  const mergeCommitMessage = "automatic";
  const mergeRetries = 3;
  const mergeRetrySleep = 1000;

  const updateLabels = { required: ["it-update"], blocking: [] };
  const updateMethod = "merge";

  const config = {
    mergeLabels,
    mergeMethod,
    mergeForks,
    mergeCommitMessage,
    mergeRetries,
    mergeRetrySleep,
    updateLabels,
    updateMethod
  };

  const context = { token, octokit, config };

  await executeLocally(context, process.env.URL);
}

main().catch(e => {
  process.exitCode = 1;
  console.error(e);
});

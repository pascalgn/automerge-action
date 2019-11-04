const Octokit = require("@octokit/rest");

const { executeLocally } = require("../lib/api");

async function main() {
  require("dotenv").config();

  const token = process.env.GITHUB_TOKEN;

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action-it"
  });

  const labels = { required: [], blocking: [] };
  const mergeLabel = "it-merge";
  const updateLabel = "it-update";
  const updateAndMergeLabel = "it-update-and-merge";
  const mergeMethod = "merge";
  const updateMethod = "merge";
  const config = { labels, mergeLabel, updateLabel, updateAndMergeLabel, mergeMethod, updateMethod };

  const context = { token, octokit, config };

  await executeLocally(context, process.env.URL);
}

main().catch(e => {
  process.exitCode = 1;
  console.error(e);
});

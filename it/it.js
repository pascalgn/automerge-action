const Octokit = require("@octokit/rest");

const { executeLocally } = require("../lib/api");

async function main() {
  require("dotenv").config();

  const token = process.env.GITHUB_TOKEN;

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action-it"
  });

  const mergeLabels = { required: ["it-merge"] };
  const mergeMethod = "merge";

  const updateLabels = { required: ["it-update"] };
  const updateMethod = "merge";

  const config = { mergeLabels, mergeMethod, updateLabels, updateMethod };

  const context = { token, octokit, config };

  await executeLocally(context, process.env.URL);
}

main().catch(e => {
  process.exitCode = 1;
  console.error(e);
});

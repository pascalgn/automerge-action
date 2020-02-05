const Octokit = require("@octokit/rest");

const { executeLocally } = require("../lib/api");
const { createConfig } = require("../lib/common");

async function main() {
  require("dotenv").config();

  const token = process.env.GITHUB_TOKEN;

  const octokit = new Octokit({
    auth: `token ${token}`,
    userAgent: "pascalgn/automerge-action-it"
  });

  const config = createConfig({
    UPDATE_LABELS: "it-update",
    MERGE_LABELS: "it-merge",
    MERGE_REMOVE_LABELS: "it-merge-remove",
    MERGE_RETRIES: "3",
    MERGE_RETRY_SLEEP: "2000"
  });

  const context = { token, octokit, config };

  await executeLocally(context, process.env.URL);
}

main().catch(e => {
  process.exitCode = 1;
  console.error(e);
});

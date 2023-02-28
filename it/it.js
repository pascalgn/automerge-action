const { Octokit } = require("@octokit/rest");

const { executeLocally } = require("../lib/api");
const { createConfig } = require("../lib/common");

async function main() {
  require("dotenv").config();

  const token = process.env.GITHUB_TOKEN;
  const baseUrl = "https://" + process.env.GHE_HOSTNAME + "/api/v3" || "https://api.github.com";

  const octokit = new Octokit({
    auth: `token ${token}`,
    baseUrl: baseUrl,
    userAgent: "pascalgn/automerge-action-it"
  });

  const config = createConfig({
    UPDATE_LABELS: "it-update",
    MERGE_LABELS: "it-merge",
    MERGE_REQUIRED_APPROVALS: "0",
    MERGE_REMOVE_LABELS: "it-merge",
    MERGE_RETRIES: "3",
    MERGE_RETRY_SLEEP: "2000",
    MERGE_ERROR_FAIL: "true",
    GHE_HOSTNAME: process.env.GHE_HOSTNAME
  });

  const context = { token, octokit, config };

  await executeLocally(context, process.env.URL);
}

main().catch(e => {
  process.exitCode = 1;
  console.error(e);
});

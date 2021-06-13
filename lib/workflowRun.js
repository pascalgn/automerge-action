const { setFailed, info, debug } = require("@actions/core");
const { getOctokit, context } = require("@actions/github")

const requireToken = () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const message = "github token must be defined";
    setFailed(message);
    throw message
  }

  try {
    getOctokit(token)
  } catch (err) {
    const message = "token provided failed to initialize octokit";
    setFailed(message);
    throw message
  }

  return token
}

const requireWorkflowId = () => {
  const id = process.env.WORKFLOW_ID;
  
  if (!id) {
    const message = "no workflow id was given, but a workflow id is required"
    setFailed(message);
    throw message;
  }

  if (typeof id === "string") {
    return parseInt(id);
  } else if (typeof id === "number") {
    return id;
  } else {
    const message = "provided workflow id is neither a stringified number or a number"
    setFailed(message);
    throw message
  }
}

const requireOctokit = () => {
  const token = requireToken();
  const github = getOctokit(token);

  if (!github) {
    const message = "something went wrong when instantiating octokit"
    setFailed(message);
    throw message
  }

  return github
}

const requirePr = async (prNum) => {
  const Github = requireOctokit();

  const { data: pr } = await Github.pulls.get({
    repo: context.repo.repo,
    owner: context.repo.owner,
    pull_number: prNum
  });

  if (!pr) {
    const message = `PR ${prNum} was not found to be associated with a real pull request`
    setFailed(message);
    throw message;
  } 

  if (pr.merged) {
    const message = `PR ${prNum} is already merged; quitting...`
    setFailed(message);
    throw message;
  }

  return pr;
};

const requireWorkflowRun = () => {
  if (context.eventName !== "workflow_run") {
    const message = [
      "this action requires that it be a side-effect run within a workflow_run;",
      "this is because the standard event triggers are not able to access this",
      "action outside of the scope of a workflow_run which is always in-scope",
      "with the main repository"
    ].join(" ")
    setFailed(message);
    throw message;
  }
  return true;
}

const requirePRFromSha = async (
  sha
) => {
  // Finds Pull request for this workflow run
  info(`\nFinding PR request id for: owner: ${context.repo.owner}, Repo: ${context.repo.repo}.\n`)
  const github = requireOctokit();
  const pullRequests = await github.search.issuesAndPullRequests({
    q: "q=" + [
      `sha:${sha}`, // retrieves pull request with this sha
      `is:pr`, // will only retrieve pull requests and not issues
      `is:open`, // will only retrive pull requests that are open
      `repo:${context.repo.owner}/${context.repo.repo}` // only considers PRs of the repo in context
    ].join("+")
  }).then(res => res.data)

  if (pullRequests.total_count === 0) {
    const message = [
      `no pull request was found to be both open and associated with the provided sha of ${sha}`,
      `make sure that the WORKFLOW-ID provided is from github.event.workflow_run.id (the triggering`,
      `event's workflow id)`
    ].join(" ")
    setFailed(message);
    throw message;
  }

  if (pullRequests.total_count > 1) {
    const message = [
      `more than one pull request was found to be both open and associated`,
      `with the provided sha of ${sha}; this action is not currently able`,
      `to deal with this edge-case; please reach out to the maintainers`,
      `if you believe this is in error`
    ].join(" ")
    setFailed(message);
    throw message;
  }

  // provided the above assertions, this number is guaranteed to be defined
  const prNum = pullRequests.items[0]?.number;
  return requirePr(prNum);
}

const requireHeadSha = async () => {
  const id = requireWorkflowId();
  const github = requireOctokit();

  const sourceRun = await github.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: id
  }).then(res => res.data).catch(err => {
    setFailed(err);
    throw err;
  });

  if (!sourceRun.head_sha) {
    const message = `workflow run found from workflow run id ${id} did not contain a head sha`
    setFailed(message);
    debug(JSON.stringify(sourceRun));
    throw message;
  }

  return sourceRun.head_sha
}

/**
 * @returns {octokit pr}: the pr associated with the triggering event of this workflow_run
 */
export const requirePRFromWorkflowRun = async () => {
  // verifies that the event type is of workflow_run
  requireWorkflowRun();
  const sha = await requireHeadSha();
  return requirePRFromSha(sha);
}
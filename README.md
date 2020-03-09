# automerge-action

GitHub action to automatically merge pull requests when they are ready.

<img src="https://pascalgn.github.io/automerge-action/screenshot.svg" width="100%">

When added, this action will run the following tasks on pull requests with the
`automerge` label:

- Changes from the base branch will automatically be merged into the pull
  request (only when "Require branches to be up to date before merging"
  is enabled in the branch protection rules)
- When the pull request is ready, it will automatically be merged
- Pull requests without any configured labels will be ignored

Labels, merge and update strategies are configurable, see [Configuration](#configuration).

A pull request is considered ready when:

1. the required number of review approvals has been given (if enabled in the
   branch protection rules) and
2. the required checks have passed (if enabled in the branch protection rules)
   and
3. the pull request is up to date (if enabled in the branch protection rules)

After the pull request has been merged successfully, the branch will _not_ be
deleted. To delete branches after they are merged,
see [automatic deletion of branches](https://help.github.com/en/articles/managing-the-automatic-deletion-of-branches).

## Usage

Create a new `.github/workflows/automerge.yml` file:

```yaml
name: automerge
on:
  pull_request:
    types:
      - labeled
      - unlabeled
      - synchronize
      - opened
      - edited
      - ready_for_review
      - reopened
      - unlocked
  pull_request_review:
    types:
      - submitted
  check_suites_run: 
    types:
      - completed
  status: {}
jobs:
  automerge:
    runs-on: ubuntu-latest
    steps:
      - name: automerge
        uses: "pascalgn/automerge-action@ccae530ae13b6af67a7a2009c266fe925844e658"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

## Configuration

The following merge options are supported:

- `MERGE_LABELS`: The labels that need to be present for a pull request to be
  merged (using `MERGE_METHOD`). The default value is `automerge`.

  This option can be a comma-separated list of labels that will be checked. All
  labels in the list need to be present, otherwise the pull request will be
  skipped (until all labels are present). Labels prefixed with an exclamation
  mark (`!`) will block a pull request from being merged, when present.

  For example, when `automerge,!wip,!work in progress` is given,
  any pull requests with the labels `wip` or `work in progress` and any pull
  requests _without_ the label `automerge` will not be merged.
  Blocking labels take precedence, so if a pull request has both labels
  `wip` and `automerge`, it will not be merged.

  When an empty string (`""`) is given, all pull requests will be merged.

- `MERGE_REMOVE_LABELS`: The labels to automatically remove from a pull request
  once it has ben merged by the action. The default value is `""`.

  This option can be a comma-separated list of labels that will be removed.

  When an empty string (`""`) is given, no labels will be removed.

- `MERGE_METHOD`: Which method to use when merging the pull request into
  the base branch. Possible values are
  [`merge`](https://help.github.com/en/articles/about-pull-request-merges) (create a merge commit),
  [`rebase`](https://help.github.com/en/articles/about-pull-request-merges#rebase-and-merge-your-pull-request-commits)
  (rebase all commits of the branch onto the base branch)
  or [`squash`](https://help.github.com/en/articles/about-pull-request-merges#squash-and-merge-your-pull-request-commits)
  (squash all commits into a single commit). The default option is `merge`.

- `MERGE_COMMIT_MESSAGE`: The commit message to use when merging the pull
  request into the base branch. Possible values are `automatic` (use GitHub's
  default message), `pull-request-title` (use the pull request's title),
  `pull-request-description` (use the pull request's description),
  `pull-request-title-and-description` or a literal
  value with optional placeholders (for example `Auto merge {pullRequest.number}`).
  The default value is `automatic`.

- `MERGE_COMMIT_MESSAGE_REGEX`: When using a commit message containing the
  PR's body, use the first capturing subgroup from this regex as the commit
  message. Can be used to separate content that should go with the commit into
  the code base's history from boilerplate associated with the PR (licensing
  notices, check lists, etc). For example, `(.*)^---` would keep everything up
  until the first 3-dash line (horizontal rule in MarkDown) from the commit
  message. The default value is empty, which disables this feature.

- `MERGE_FORKS`: Whether merging from external repositories is enabled
  or not. By default, pull requests with branches from forked repositories will
  be merged the same way as pull requests with branches from the main
  repository. Set this option to `false` to disable merging of pull requests
  from forked repositories.

- `MERGE_RETRIES` and `MERGE_RETRY_SLEEP`: Sometimes, the pull request check
  runs haven't finished yet, so the action will retry the merge after some time.
  The number of retries can be set with `MERGE_RETRIES`.
  The default number of retries is `6` and setting it to `0` disables the retry logic.
  `MERGE_RETRY_SLEEP` sets the time to sleep between retries, in milliseconds.
  The default is `10000` (10 seconds) and setting it to `0` disables sleeping
  between retries.

  If some cases (travis ci for example), this action can also be triggered by the successful completion of checks
  (i.e. builds) via the `check_suites_run` statement in the `automerge.yml`. In that case
  you can safely set this to `0`.

- `MERGE_DELETE_BRANCH`: Automatic deletion of branches does not work for all
  repositories. Set this option to `true` to automatically delete branches
  after they have been merged.

The following update options are supported:

- `UPDATE_LABELS`: The labels that need to be present for a pull request to be
  updated (using `UPDATE_METHOD`). The default value is `automerge`.

  Note that updating will only happen when the option "Require branches to be
  up to date before merging" is enabled in the branch protection rules.

  This option can be a comma-separated list of labels, see the `MERGE_LABELS`
  option for more information.

- `UPDATE_METHOD`: Which method to use when updating the pull request
  to the base branch. Possible values are `merge` (create a merge commit) or
  `rebase` (rebase the branch onto the head of the base branch). The default
  option is `merge`.

  When the option is `rebase` and the [rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
  failed, the action will exit with error code 1. This will also be visible
  in the pull request page, with a message like "this branch has conflicts
  that must be resolved" and a list of conflicting files.

Also, the following general options are supported:

- `GITHUB_TOKEN`: This should always be `"${{ secrets.GITHUB_TOKEN }}"`.
  However, in some cases it can be useful to run this action as a certain user
  (by default, it will run as `github-actions`). This can be useful if you want
  to use the "Restrict who can push to matching branches" option in the branch
  protection rules, for example.

  To use this setting for manually providing a token, you need to create a
  [personal access token](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line)
  for the user (make sure to check `public_repo` when it's a public repository
  or `repo` when it's a private repository). All API requests (merge/rebase)
  will then be executed as the specified user. The token should be kept secret,
  so make sure to add it as secret, not as environment variable, in the GitHub
  workflow file!

You can configure the environment variables in the workflow file like this:

```yaml
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
          MERGE_LABELS: "automerge,!work in progress"
          MERGE_REMOVE_LABELS: "automerge"
          MERGE_METHOD: "squash"
          MERGE_COMMIT_MESSAGE: "pull-request-description"
          MERGE_FORKS: "false"
          MERGE_RETRIES: "6"
          MERGE_RETRY_SLEEP: "10000"
          UPDATE_LABELS: ""
          UPDATE_METHOD: "rebase"
```

## Limitations

- When a pull request is merged by this action, the merge will not trigger other GitHub workflows.
  Similarly, when another GitHub workflow creates a pull request, this action will not be triggered.
  This is because [an action in a workflow run can't trigger a new workflow run](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/events-that-trigger-workflows).
- When a check from a build tools like Jenkins or CircleCI completes, GitHub
  triggers the action workflow, but sometimes the pull request state is still
  pending, blocking the merge. This is [an open issue](https://github.com/pascalgn/automerge-action/issues/7).
- Currently, there is no way to trigger workflows when the pull request branch
  becomes out of date with the base branch. There is a request in the
  [GitHub community forum](https://github.community/t5/GitHub-Actions/New-Trigger-is-mergable-state/m-p/36908).

## Debugging

To run the action with full debug logging, update your workflow file as follows:

```
      - name: automerge
        uses: pascalgn/automerge-action@...
        with:
          args: "--trace"
```

If you need to further debug the action, you can run it locally.

You will need a [personal access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).

Then clone this repository, create a file `.env` in the repository, such as:

```
GITHUB_TOKEN="123abc..."
URL="https://github.com/pascalgn/repository-name/pull/123"
```

Install dependencies with `yarn`, and finally run `yarn it` (or `npm run it`).

## License

[MIT](LICENSE)

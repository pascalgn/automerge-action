# automerge-action

GitHub action to automatically merge pull requests when they are ready.

<img src="https://pascalgn.github.io/automerge-action/screenshot.svg" width="100%">

By default adding an `automerge` label to your pull request means that changes
from the base branch will automatically be merged into the pull request, but
only when "Require branches to be up to date before merging" is enabled in the
branch protection rules. When the PR is ready, it will automatically be merged.

> pull requests without any configured labels will be ignored

Labels, merge and update strategies are all configurable, see [Configuration](#configuration).

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
  status: {}
jobs:
  automerge:
    runs-on: ubuntu-latest
    steps:
      - name: automerge
        uses: "pascalgn/automerge-action@3d49a35881d054bb29423e3f3fd7f19b0867e38d"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

### Automatic PR branch updates

Currently github actions has no way to trigger workflows when the PR branch becomes out of date with the base branch; this has some limitations as described [here](https://github.community/t5/GitHub-Actions/New-Trigger-is-mergable-state/m-p/36908).

## Configuration

The following environment variables are supported:

- `LABELS`: A comma-separated list of labels that will be checked.
  These labels need to be present for a pull request to be merged.
  Labels prefixed with an exclamation mark (`!`) will block a pull request
  from being merged, when present.

  For example, when `!wip,!work in progress,documentation-updated` is given,
  any pull requests with the labels `wip` or `work in progress` and any pull
  requests _without_ the label `documentation-updated` will not be merged.
  Blocking labels take precedence, so if a pull request has both labels
  `wip` and `documentation-updated`, it will not be merged.

- `MERGE_LABEL`: The label that indicates that the pull request will be merged
  using the configured merge method (see `MERGE_METHOD`). The default label 
  is `automerge`.
- `UPDATE_LABEL`: The label that indicates that the pull request will be updated
  with the base branch using the configured update method (see `UPDATE_METHOD`).
  The default label is `automerge`
- `MERGE_METHOD`: Specify which method to use when merging the pull request
  into the base branch. Possible values are
  [`merge`](https://help.github.com/en/articles/about-pull-request-merges) (create a merge commit),
  [`rebase`](https://help.github.com/en/articles/about-pull-request-merges#rebase-and-merge-your-pull-request-commits)
  (rebase all commits of the branch onto the base branch)
  or [`squash`](https://help.github.com/en/articles/about-pull-request-merges#squash-and-merge-your-pull-request-commits)
  (squash all commits into a single commit). The default option is `merge`.
- `UPDATE_METHOD`: Specify which method to use when updating the pull request
  to the base branch. Possible values are `merge` (create a merge commit),
  `rebase` (rebases the branch onto the head of the base branch). The default
  option is `merge`.
- `MERGE_FORKS`: Specify whether merging from external repositories is enabled
  or not. By default, pull requests with branches from forked repositories will
  be merged the same way as pull requests with branches from the main
  repository. Set this option to `false` to disable merging of pull requests
  from forked repositories.
- `COMMIT_MESSAGE_TEMPLATE`: Specify the commit message to use when
  merging the pull request into the base branch. Possible values are
  `automatic` (use GitHub's automatic message), `pull-request-title` (use the
  pull request's title), `pull-request-description` (use the pull request's
  description), and `pull-request-title-and-description`. The default value is
  `automatic`.
- `TOKEN`: In some cases it can be useful to run this action as a certain user
  (by default, it will run as `github-actions`). This can be useful if you want
  to use the _Restrict who can push to matching branches_ option in the branch
  protection rules, for example.

  To use this setting, you need to create a
  [personal access token](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line)
  for the user (make sure to check `public_repo` when it's a public repository
  or `repo` when it's a private repository). All API requests (merge/rebase)
  will then be executed as the specified user. The token should be kept secret,
  so make sure to add it as secret, not as environment variable, in the GitHub
  workflow file.

You can configure the environment variables in the workflow file like this:

```yaml
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
          LABELS: "!wip,!work in progress,documentation-updated"
          MERGE_LABEL: "ready-to-merge"
          UPDATE_LABEL: "ready-to-update"
          MERGE_METHOD: "squash"
          UPDATE_METHOD: "rebase"
          MERGE_FORKS: "false"
          COMMIT_MESSAGE_TEMPLATE: "pull-request-description"
```

## License

MIT

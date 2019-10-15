# automerge-action

GitHub action to automatically merge pull requests when they are ready.

<img src="https://pascalgn.github.io/automerge-action/screenshot.svg" width="100%">

This action will behave differently based on the labels assigned to a pull
request:

- `automerge` means that changes from the base branch will automatically be
  merged into the pull request, but only when "Require branches to be up to
  date before merging" is enabled in the branch protection rules. When the PR
  is ready, it will automatically be merged.
- `autorebase` means that when changes happen in the base branch, the pull
  request will be rebased onto the base branch. When the PR is ready, it will
  automatically be merged into the base branch.
- pull requests without one of these labels will be ignored

These labels are configurable, see [Configuration](#configuration).

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
        uses: "pascalgn/automerge-action@a7a731467672c853f76342a06615311a787d5591"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

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
- `AUTOMERGE`: The label that indicates that the pull request will be merged
  using the configured merge method (see `MERGE_METHOD`). When the environment
  variable is not set, the default label `automerge` will be used.
- `AUTOREBASE`: The label that indicates that the pull request will be rebased
  onto the base branch whenever this pull request is updated. When the pull
  request is ready, it will be merged using the configured merge method (see
  `MERGE_METHOD`). When the environment variable is not set, the default label
  `autorebase` will be used.
- `MERGE_METHOD`: Specify which method to use when merging the pull request
  into the base branch. Possible values are
  [`merge`](https://help.github.com/en/articles/about-pull-request-merges) (create a merge commit),
  [`rebase`](https://help.github.com/en/articles/about-pull-request-merges#rebase-and-merge-your-pull-request-commits)
  (rebase all commits of the branch onto the base branch)
  or [`squash`](https://help.github.com/en/articles/about-pull-request-merges#squash-and-merge-your-pull-request-commits)
  (squash all commits into a single commit). The default option is `merge`.
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
          AUTOMERGE: "ready-to-merge"
          AUTOREBASE: "ready-to-rebase-and-merge"
          MERGE_METHOD: "squash"
          MERGE_FORKS: "false"
          COMMIT_MESSAGE_TEMPLATE: "pull-request-description"
```

## License

MIT

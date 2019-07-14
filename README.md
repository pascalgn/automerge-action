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

After the pull request has been merged successfully, the branch will be
deleted (unless there exist branch protection rules preventing this branch
from being deleted).

## Usage

Add this to your `.github/main.workflow` file:

```
workflow "automerge pull requests on updates" {
  on = "pull_request"
  resolves = ["automerge"]
}

workflow "automerge pull requests on reviews" {
  on = "pull_request_review"
  resolves = ["automerge"]
}

workflow "automerge pull requests on status updates" {
  on = "status"
  resolves = ["automerge"]
}

action "automerge" {
  uses = "pascalgn/automerge-action@ef030fabb510b9a5a3bc2e3a0123638e11e72541"
  secrets = ["GITHUB_TOKEN"]
}
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

```
action "automerge" {
  uses = ...
  secrets = ["GITHUB_TOKEN"]
  env = {
    LABELS = "!wip,!work in progress,documentation-updated"
    AUTOMERGE = "ready-to-merge"
    AUTOREBASE = "ready-to-rebase-and-merge"
    MERGE_METHOD = "squash"
  }
}
```

## License

MIT

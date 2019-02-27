# automerge-action

GitHub action to automatically merge pull requests that are ready.

This action will behave differently based on the labels assigned to a pull
request:

- `automerge` means that changes from the base branch will automatically be
  merged into the pull request, but only when "Require branches to be up to
  date before merging" is enabled in the branch protection rules. When the PR
  is ready, it will automatically be merged.
- `autorebase` means that when changes happen in the base branch, the pull
  request will be rebased onto the base branch. When the PR is ready, it will
  automatically be merged (with a merge commit) into the base branch.
- pull requests without one of these labels will be ignored

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
  uses = "pascalgn/automerge-action@a3bf8847ac930a3cad61fb7322ecb1a4539ff459"
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

You can configure the environment variables in the workflow file like this:

```
action "automerge" {
  uses = ...
  secrets = ["GITHUB_TOKEN"]
  env = {
    LABELS = "!wip,!work in progress,documentation-updated"
  }
}
```

## License

MIT

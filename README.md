# automerge-action

[![GitHubActions](https://img.shields.io/badge/listed%20on-GitHubActions-blue.svg)](https://github-actions.netlify.com/automerge)

GitHub action to automatically merge pull requests that are ready.

This action will behave differently based on the labels assigned to a pull request:

- `automerge` means that changes from the base branch will automatically be merged into the pull request, but only when "Require branches to be up to date before merging" is enabled in the branch protection rules. When the PR is ready, it will automatically be merged.
- `autorebase` means that when changes happen in the base branch, the pull request will be rebased onto the base branch. When the PR is ready, it will automatically be merged (with a merge commit) into the base branch.
- pull requests without one of these labels will be ignored

A pull request is considered ready when:

1. the required number of review approvals has been given (if enabled in the branch protection rules) and
2. the required checks have passed (if enabled in the branch protection rules) and
3. the pull request is up to date (if enabled in the branch protection rules)

After the pull request has been merged successfully, the branch will be deleted (unless there exist branch protection rules preventing this branch from being deleted).

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

workflow "rebase other pull requests after merges" {
  on = "push"
  resolves = ["automerge"]
}

action "automerge" {
  uses = "pascalgn/automerge-action@9d655352861c757731df72b6ac21d65fdf6d92ee"
  secrets = ["GITHUB_TOKEN"]
}
```

## License

MIT

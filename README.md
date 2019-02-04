# automerge-action

GitHub action to automatically merge pull requests that are ready.

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

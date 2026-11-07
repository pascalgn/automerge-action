# 🚀 Automerge Action

**Automatically merge GitHub Pull Requests when all required conditions are satisfied.**

[![GitHub Marketplace](https://img.shields.io/badge/GitHub-Marketplace-blue?logo=github)](https://github.com/marketplace)
[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-2088FF?logo=github-actions)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

`automerge-action` is a GitHub Action that simplifies pull request management by automatically updating and merging pull requests once they meet the repository's required conditions.

![Automerge Action Screenshot](https://pascalgn.github.io/automerge-action/screenshot.svg)

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [How It Works](#-how-it-works)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Supported Events](#-supported-events)
- [Outputs](#-outputs)
- [Debugging](#-debugging)
- [Limitations](#-limitations)
- [License](#-license)

## 📖 Overview

Managing multiple pull requests manually can take time. This action automates the process by checking pull request conditions and merging eligible contributions.

Once configured, it can:

- Automatically update pull request branches.
- Check required reviews and status checks.
- Merge pull requests when they are ready.
- Support different merge strategies.
- Apply label-based merge rules.
- Handle pull requests from external forks.

> **Note:** GitHub also provides a built-in [Auto-merge feature](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request). This project continues to provide additional configurable functionality.

## ✨ Key Features

| Feature | Description |
|---|---|
| Automatic merging | Merge eligible pull requests automatically. |
| Label management | Control merging through configurable labels. |
| Review validation | Check required pull request approvals. |
| Status checks | Wait for required CI checks to pass. |
| Branch updates | Update branches using merge or rebase. |
| Merge strategies | Support merge, squash, and rebase. |
| Fork support | Configure automatic merging for external forks. |
| Retry mechanism | Retry merging when checks are still running. |
| Debug logging | Enable detailed logs for troubleshooting. |

## ⚙️ How It Works

The action follows a simple workflow:

1. A pull request is created or updated.
2. The action checks whether the required labels are present.
3. It checks the required review approvals.
4. It verifies the required status checks.
5. It checks whether the branch is up to date.
6. If all configured conditions are satisfied, the pull request is merged.

### Pull Request Readiness

A pull request is considered ready when:

- The required number of approvals has been received, if required by branch protection.
- All required status checks have passed.
- The branch is up to date with the base branch, if required.

## 🚀 Getting Started

### Step 1: Create a Workflow File

Create a file named:

`.github/workflows/automerge.yml`

### Step 2: Add the Workflow Configuration

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

  check_suite:
    types:
      - completed

  status: {}

jobs:
  automerge:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Automerge
        id: automerge
        uses: pascalgn/automerge-action@v0.16.4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 3: Configure Branch Protection

For reliable automatic merging:

1. Open your GitHub repository.
2. Navigate to **Settings → Branches**.
3. Configure branch protection rules.
4. Enable required status checks and review approvals as needed.
5. Enable the required up-to-date branch setting if you want automatic branch updates.

### Step 4: Add the Automerge Label

Create a label named:

`automerge`

Add this label to a pull request that you want the action to consider for automatic merging.

Once all configured requirements are satisfied, the action will attempt to merge it.

## 🔧 Configuration

The action supports environment variables to customize its behavior.

### 1. Merge Configuration

| Variable | Description | Default |
|---|---|---|
| `MERGE_LABELS` | Labels required for merging. | `automerge` |
| `MERGE_REMOVE_LABELS` | Labels removed after merging. | Empty |
| `MERGE_METHOD` | Merge strategy: `merge`, `rebase`, or `squash`. | `merge` |
| `MERGE_METHOD_LABELS` | Assign merge methods using labels. | Empty |
| `MERGE_METHOD_LABEL_REQUIRED` | Require a merge-method label. | `false` |
| `MERGE_REQUIRED_APPROVALS` | Minimum required approvals. | `0` |
| `MERGE_FORKS` | Allow pull requests from forks. | `true` |
| `MERGE_RETRIES` | Number of merge retries. | `6` |
| `MERGE_RETRY_SLEEP` | Delay between retries in milliseconds. | `5000` |
| `MERGE_DELETE_BRANCH` | Delete the branch after merging. | `false` |
| `MERGE_ERROR_FAIL` | Fail the workflow if merging fails. | `false` |

### 2. Update Configuration

| Variable | Description | Default |
|---|---|---|
| `UPDATE_LABELS` | Labels required for branch updates. | `automerge` |
| `UPDATE_METHOD` | Update strategy: `merge` or `rebase`. | `merge` |
| `UPDATE_RETRIES` | Number of update retries. | `1` |
| `UPDATE_RETRY_SLEEP` | Delay between update retries in milliseconds. | `5000` |

### 3. General Configuration

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub authentication token. |
| `PULL_REQUEST` | Specific pull request to process. |
| `BASE_BRANCHES` | Restrict merging to specified base branches. |
| `MAX_PR_COUNT` | Maximum pull requests processed in one run. |
| `MERGE_FILTER_AUTHOR` | Restrict automatic merging to a specific author. |
| `MERGE_READY_STATE` | Specify pull request states considered mergeable. |

### 4. Example Custom Configuration

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  MERGE_LABELS: "automerge,!work in progress"
  MERGE_REMOVE_LABELS: "automerge"
  MERGE_METHOD: "squash"
  MERGE_FORKS: "false"
  MERGE_RETRIES: "6"
  MERGE_RETRY_SLEEP: "10000"
  MERGE_REQUIRED_APPROVALS: "1"
  UPDATE_LABELS: ""
  UPDATE_METHOD: "rebase"
  MAX_PR_COUNT: "25"
```

For a complete list of configuration options and their behavior, see the original configuration documentation in this README's project history.

## 📡 Supported Events

The action can be triggered by the following GitHub events:

- `check_run`
- `check_suite`
- `issue_comment`
- `pull_request_review`
- `pull_request_target`
- `pull_request`
- `push`
- `repository_dispatch`
- `schedule`
- `status`
- `workflow_dispatch`
- `workflow_run`

For details, see [GitHub Actions Events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows).

## 📤 Outputs

The action provides two outputs:

| Output | Description |
|---|---|
| `mergeResult` | Result of the action execution. |
| `pullRequestNumber` | Number of the processed pull request. |

Possible `mergeResult` values:

- `skipped`
- `not_ready`
- `author_filtered`
- `merge_failed`
- `merged`

### Example: Using Action Outputs

```yaml
steps:
  - name: Automerge
    id: automerge
    uses: pascalgn/automerge-action@v0.16.4
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  - name: Display Merge Result
    if: ${{ steps.automerge.outputs.mergeResult == 'merged' }}
    run: |
      echo "Pull request ${{ steps.automerge.outputs.pullRequestNumber }} merged successfully!"
```

**Important:** When multiple pull requests are processed, only the first one is available through the outputs.

## 🐛 Debugging

If the action does not behave as expected, enable detailed logging.

Add the following environment variable to your workflow:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LOG: "DEBUG"
```

You can also use:

- `DEBUG`
- `TRACE`

### Running Locally

To debug the action locally:

1. Clone the repository.
2. Install dependencies using `yarn`.
3. Create a `.env` file.
4. Add your GitHub personal access token and pull request URL.
5. Run the integration test command.

Example `.env`:

```env
GITHUB_TOKEN="your-token"
URL="https://github.com/owner/repository/pull/123"
```

Run:

```bash
yarn
yarn it
```

Keep your personal access token private. Never commit it to Git.

## ⚠️ Limitations

- Merging a pull request using the default `GITHUB_TOKEN` will not trigger other GitHub Actions workflows in the same way as a normal user-generated event.
- A personal access token can be used when additional workflow triggering behavior is required.
- Pull requests may not be automatically updated when their branches become outdated unless another supported event triggers the action.
- Branch protection rules and repository permissions can affect whether a pull request can be merged.

For more details, refer to the [GitHub Actions documentation](https://docs.github.com/en/actions).

## 📜 License

This project is licensed under the [MIT License](./LICENSE).

---

**Built for simpler and more efficient GitHub pull request management.**

If you find this project useful, consider giving it a ⭐ on GitHub and contributing improvements!

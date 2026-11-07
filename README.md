# 🚀 Automerge Action

**Automatically update and merge GitHub Pull Requests when they meet the required conditions.**

[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-2088FF?logo=github-actions)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-v0.16.4-blue)](https://github.com/pascalgn/automerge-action/releases)

`automerge-action` is a GitHub Action that automates pull request updates and merging. It checks configured labels, required reviews, status checks, and branch protection requirements before attempting to merge a pull request.

![Automerge Action Screenshot](https://pascalgn.github.io/automerge-action/screenshot.svg)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
  - [Merge Options](#1-merge-options)
  - [Update Options](#2-update-options)
  - [General Options](#3-general-options)
  - [Configuration Example](#4-configuration-example)
- [Supported Events](#-supported-events)
- [Outputs](#-outputs)
- [Limitations](#-limitations)
- [Debugging](#-debugging)
- [License](#-license)

## 📖 Overview

Managing pull requests manually can become time-consuming, especially in repositories with multiple contributors.

Automerge Action simplifies this process by automatically checking pull request requirements and merging eligible pull requests.

### Key Benefits

- Reduce manual pull request management.
- Automatically update branches when required.
- Validate reviews and status checks.
- Control merging through labels.
- Choose different merge strategies.
- Configure automatic branch deletion.
- Support pull requests from external repositories.

**GitHub built-in alternative:** GitHub provides its own [Auto-merge functionality](https://docs.github.com/en/github/collaborating-with-pull-requests/automatically-merging-a-pull-request). However, this project offers additional configurable functionality, including automatic rebasing.

## ✨ Features

| Feature | Description |
|---|---|
| Automatic Merging | Merge pull requests when requirements are satisfied. |
| Label Management | Control which pull requests can be merged. |
| Review Validation | Check required approval counts. |
| Status Checks | Wait for required CI checks. |
| Branch Updates | Update branches using merge or rebase. |
| Merge Strategies | Support merge, rebase, and squash. |
| Fork Support | Configure merging from external repositories. |
| Retry Mechanism | Retry operations when checks are incomplete. |
| Branch Deletion | Optionally delete branches after merging. |
| Debug Logging | Enable detailed logs for troubleshooting. |

## 🔄 How It Works

The action follows a simple process:

1. A pull request is created or updated.
2. The action checks the configured labels.
3. It verifies the required review approvals.
4. It checks the required status checks.
5. It checks whether the pull request branch is up to date.
6. If all required conditions are satisfied, it attempts to merge the pull request.

### Pull Request Readiness

A pull request is considered ready when:

- The required number of review approvals has been received, if enabled in branch protection rules.
- All required status checks have passed, if configured.
- The pull request branch is up to date with the base branch, if required.

After a successful merge, the source branch is not deleted by default. Automatic branch deletion can be enabled through configuration.

For GitHub's branch deletion settings, see [Automatically deleting branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-the-automatic-deletion-of-branches).

## 🚀 Getting Started

### Step 1: Create a Workflow File

Create the following file in your repository:

`.github/workflows/automerge.yml`

### Step 2: Add the Workflow Configuration

Copy the following configuration:

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
      - id: automerge
        name: automerge
        uses: pascalgn/automerge-action@v0.16.4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

For the latest version, check the [GitHub Releases](https://github.com/pascalgn/automerge-action/releases).

### Step 3: Configure Branch Protection Rules

For repositories that require reviews or status checks:

1. Open your GitHub repository.
2. Navigate to **Settings → Branches**.
3. Configure the branch protection rules.
4. Enable required approvals and status checks as needed.
5. Enable the up-to-date branch requirement if you want automatic branch updates.

### Step 4: Add the Automerge Label

Create a label named:

`automerge`

Add this label to a pull request that should be considered for automatic merging.

Once all configured requirements are satisfied, the action will attempt to merge the pull request.

## ⚙️ Configuration

The action supports environment variables to customize merging, branch updates, and general behavior.

### 1. Merge Options

| Variable | Description | Default |
|---|---|---|
| `MERGE_LABELS` | Labels required for merging. | `automerge` |
| `MERGE_REMOVE_LABELS` | Labels automatically removed after merging. | `""` |
| `MERGE_METHOD` | Merge strategy: `merge`, `rebase`, or `squash`. | `merge` |
| `MERGE_METHOD_LABELS` | Configure merge methods using labels. | `""` |
| `MERGE_METHOD_LABEL_REQUIRED` | Require a merge-method label. | `false` |
| `MERGE_COMMIT_MESSAGE` | Customize the merge commit message. | `automatic` |
| `MERGE_COMMIT_MESSAGE_REGEX` | Extract a commit message using a regular expression. | Empty |
| `MERGE_FILTER_AUTHOR` | Restrict merging to a specific pull request author. | Not set |
| `MERGE_FORKS` | Allow merging pull requests from forks. | `true` |
| `MERGE_RETRIES` | Number of merge retries. | `6` |
| `MERGE_RETRY_SLEEP` | Delay between merge retries in milliseconds. | `5000` |
| `MERGE_REQUIRED_APPROVALS` | Number of required review approvals. | `0` |
| `MERGE_DELETE_BRANCH` | Delete the source branch after merging. | `false` |
| `MERGE_DELETE_BRANCH_FILTER` | Branches excluded from automatic deletion. | `""` |
| `MERGE_ERROR_FAIL` | Fail the workflow if merging is unsuccessful. | `false` |
| `MERGE_READY_STATE` | Pull request states considered mergeable. | `clean,has_hooks,unknown,unstable` |

#### Label Configuration

`MERGE_LABELS` accepts a comma-separated list of labels.

All positive labels must be present for a pull request to be merged. Labels prefixed with `!` act as blocking labels.

Example:

```yaml
MERGE_LABELS: "automerge,!wip,!work in progress"
```

This means:

- The `automerge` label must be present.
- The `wip` label must not be present.
- The `work in progress` label must not be present.

Blocking labels take priority over positive labels.

Setting `MERGE_LABELS` to an empty string allows all pull requests to be considered for merging.

#### Merge Strategy

The `MERGE_METHOD` option supports three strategies:

| Method | Description |
|---|---|
| `merge` | Creates a merge commit. |
| `rebase` | Rebases all commits onto the base branch. |
| `squash` | Combines all commits into a single commit. |

The default strategy is `merge`.

#### Merge Method Based on Labels

Use `MERGE_METHOD_LABELS` to select a merge strategy based on pull request labels.

Example:

```yaml
MERGE_METHOD_LABELS: "automerge=merge,autosquash=squash"
```

If no matching label is present, the action uses the default `MERGE_METHOD`.

Set `MERGE_METHOD_LABEL_REQUIRED` to `true` to require one of the configured merge-method labels.

#### Merge Commit Message

The `MERGE_COMMIT_MESSAGE` option supports:

- `automatic` – Use GitHub's default commit message.
- `pull-request-title` – Use the pull request title.
- `pull-request-description` – Use the pull request description.
- `pull-request-title-and-description` – Use both title and description.
- A custom text value with optional placeholders.

Example:

```yaml
MERGE_COMMIT_MESSAGE: "Auto merge {pullRequest.number}"
```

#### Commit Message Filtering

Use `MERGE_COMMIT_MESSAGE_REGEX` to extract a specific portion of the pull request description when generating a commit message.

Example:

```yaml
MERGE_COMMIT_MESSAGE_REGEX: "(.*)^---"
```

This keeps the content before the first horizontal separator.

The default is empty, which disables this feature.

#### Retry Configuration

Sometimes status checks may not have completed when the action first runs.

Configure retries using:

```yaml
MERGE_RETRIES: "6"
MERGE_RETRY_SLEEP: "5000"
```

- `MERGE_RETRIES` controls the number of retry attempts.
- `MERGE_RETRY_SLEEP` controls the delay between attempts in milliseconds.
- Setting either value to `0` disables the corresponding retry behavior.

#### Branch Deletion

Automatic branch deletion can be enabled with:

```yaml
MERGE_DELETE_BRANCH: "true"
```

To protect specific branches from deletion, configure:

```yaml
MERGE_DELETE_BRANCH_FILTER: "main,develop"
```

GitHub-protected branches are not deleted by this option.

### 2. Update Options

These options control how pull request branches are updated with changes from the base branch.

| Variable | Description | Default |
|---|---|---|
| `UPDATE_LABELS` | Labels required for updating branches. | `automerge` |
| `UPDATE_METHOD` | Branch update strategy: `merge` or `rebase`. | `merge` |
| `UPDATE_RETRIES` | Number of update retry attempts. | `1` |
| `UPDATE_RETRY_SLEEP` | Delay between update retries in milliseconds. | `5000` |

**Important:** Automatic branch updates only happen when the branch protection setting **Require branches to be up to date before merging** is enabled.

The `UPDATE_LABELS` option follows the same label rules as `MERGE_LABELS`.

#### Update Strategies

| Method | Description |
|---|---|
| `merge` | Creates a merge commit to update the pull request branch. |
| `rebase` | Rebases the pull request branch onto the base branch. |

If rebasing fails, the action exits with an error and GitHub will indicate that merge conflicts need to be resolved.

### 3. General Options

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub authentication token used by the action. |
| `PULL_REQUEST` | Specify a particular pull request to process. |
| `BASE_BRANCHES` | Restrict processing to specified base branches. |
| `MAX_PR_COUNT` | Maximum number of pull requests considered in one run. |

#### GITHUB_TOKEN

The recommended configuration is:

```yaml
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

By default, the action operates using the `github-actions` identity.

In some cases, a Personal Access Token (PAT) can be used to execute API requests as a specific GitHub user.

For example, this can help when branch protection rules restrict who can push to matching branches.

If using a PAT:

- Create a token with the required repository permissions.
- Store it in GitHub Actions Secrets.
- Never expose the token in your workflow file or commit it to the repository.

See [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

#### PULL_REQUEST

This option allows a specific pull request to be processed.

Example:

```yaml
PULL_REQUEST: "1234"
```

To process a pull request from another repository, specify its repository and pull request number:

```yaml
PULL_REQUEST: "Some-Org/Some-Repo/1234"
```

#### BASE_BRANCHES

Restrict automatic merging to specific base branches.

Example:

```yaml
BASE_BRANCHES: "main,dev"
```

#### MAX_PR_COUNT

Controls how many pull requests are considered in a single execution.

Example:

```yaml
MAX_PR_COUNT: "25"
```

The default value is `10`.

### 4. Configuration Example

The following example combines commonly used configuration options:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  MERGE_LABELS: "automerge,!work in progress"
  MERGE_REMOVE_LABELS: "automerge"
  MERGE_METHOD: "squash"
  MERGE_COMMIT_MESSAGE: "pull-request-description"

  MERGE_FORKS: "false"
  MERGE_RETRIES: "6"
  MERGE_RETRY_SLEEP: "10000"
  MERGE_REQUIRED_APPROVALS: "0"

  UPDATE_LABELS: ""
  UPDATE_METHOD: "rebase"

  PULL_REQUEST: "1234"
  MAX_PR_COUNT: "25"
```

You can add or remove options depending on your repository requirements.

## 📡 Supported Events

Automerge Action supports the following GitHub events:

| Event | Purpose |
|---|---|
| `check_run` | Triggered when a check run changes. |
| `check_suite` | Triggered when a check suite changes. |
| `issue_comment` | Triggered when an issue or pull request comment is created. |
| `pull_request_review` | Triggered when a pull request review is submitted. |
| `pull_request_target` | Triggered for pull request activity in the base repository context. |
| `pull_request` | Triggered by pull request activity. |
| `push` | Triggered when commits are pushed. |
| `repository_dispatch` | Triggered by an external repository dispatch event. |
| `schedule` | Triggered by a scheduled workflow. |
| `status` | Triggered when a commit status changes. |
| `workflow_dispatch` | Manually triggered workflow execution. |
| `workflow_run` | Triggered when another workflow run completes. |

For more information, see:

- [Events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)

## 📤 Outputs

The action provides two outputs.

| Output | Description |
|---|---|
| `mergeResult` | Result of the merge operation. |
| `pullRequestNumber` | Number of the processed pull request. Returns `0` if no pull request was affected. |

### Possible Merge Results

| Result | Description |
|---|---|
| `skipped` | The pull request was skipped. |
| `not_ready` | The pull request does not meet the merge requirements. |
| `author_filtered` | The pull request author did not match the configured filter. |
| `merge_failed` | The merge operation failed. |
| `merged` | The pull request was successfully merged. |

### Example: Using Outputs

To access the outputs, assign an `id` to the action step.

```yaml
steps:
  - id: automerge
    name: automerge
    uses: pascalgn/automerge-action@v0.16.4
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  - name: Display Merge Result
    if: ${{ steps.automerge.outputs.mergeResult == 'merged' }}
    run: |
      echo "Pull request ${{ steps.automerge.outputs.pullRequestNumber }} merged successfully!"
```

**Important Notes:**

1. When multiple pull requests are affected, only the first one is available through the outputs.
2. The action step must have an `id` to access its outputs.
3. Using the default `GITHUB_TOKEN` will not trigger other workflows for the resulting merge event in the same way as using a PAT.

See [GitHub Actions Job Outputs](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idoutputs).

## ⚠️ Limitations

There are some limitations to consider when using this action.

### 1. Workflow Triggering

When a pull request is merged using the default `GITHUB_TOKEN`, the resulting event generally will not trigger other GitHub Actions workflows.

Similarly, when another workflow creates a pull request, this action will not automatically be triggered by that event in the usual way.

The `workflow_run` event is an exception and can be triggered as expected.

### 2. Personal Access Token

A Personal Access Token can be used when you need additional workflow triggering behavior.

However, if the PAT belongs to an administrator and branch restrictions do not include administrators, a pull request might be merged even when it would not be mergeable for other users.

See [Issue #65](https://github.com/pascalgn/automerge-action/issues/65).

### 3. Outdated Branch Detection

Currently, there is no direct event that triggers this action specifically when a pull request branch becomes outdated with its base branch.

See the related [GitHub Community Discussion](https://github.community/t5/GitHub-Actions/New-Trigger-is-mergable-state/m-p/36908).

## 🐛 Debugging

If the action does not work as expected, enable detailed logging to understand what is happening during execution.

### Enable Debug Logging

Add the following environment variable to your workflow:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LOG: "DEBUG"
```

For more detailed information, use:

```yaml
LOG: "TRACE"
```

### Running the Action Locally

You can also execute the action locally for debugging.

**Requirements:**

- Node.js
- Yarn or npm
- GitHub Personal Access Token

**Step 1: Clone the repository**

```bash
git clone https://github.com/pascalgn/automerge-action.git
cd automerge-action
```

**Step 2: Install dependencies**

```bash
yarn
```

**Step 3: Create a `.env` file**

Add your GitHub token and pull request URL:

```env
GITHUB_TOKEN="your-personal-access-token"
URL="https://github.com/owner/repository/pull/123"
```

**Step 4: Run the integration test command**

```bash
yarn it
```

Alternatively, use:

```bash
npm run it
```

**Security Reminder:** Never commit your `.env` file or expose your personal access token publicly.

## 🤝 Contributing

Contributions are welcome!

If you would like to improve this project:

1. Fork the repository.
2. Create a new branch for your changes.
3. Make your improvements.
4. Test your changes.
5. Submit a pull request describing your contribution.

For bugs and feature requests, use the [GitHub Issues](https://github.com/pascalgn/automerge-action/issues) page.

## 📜 License

This project is distributed under the [MIT License](./LICENSE).

---

**Thank you for using Automerge Action!**

If you find this project useful, consider giving it a ⭐ on GitHub and contributing to its development.

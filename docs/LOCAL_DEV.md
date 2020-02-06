If you need to debug the action, you can run it locally:

You will need a [personal access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).

Then clone this repository, create a file `.env` in the repository, such as:

```
GITHUB_TOKEN="123abc..."
URL="https://github.com/pascalgn/repository-name/pull/123"
```

Install dependencies with `yarn`, and finally run `yarn it` (or `npm run it`).

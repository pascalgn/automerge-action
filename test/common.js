function pullRequest() {
  return {
    number: 1,
    title: "Update README",
    body: "This PR updates the README",
    state: "open",
    locked: false,
    merged: false,
    mergeable: true,
    rebaseable: true,
    mergeable_state: "clean",
    commits: 2,
    labels: [{ name: "automerge" }],
    head: {
      ref: "patch-1",
      sha: "2c3b4d5",
      user: { login: "username" },
      repo: {
        name: "repository",
        full_name: "username/repository",
        owner: { login: "username" }
      }
    },
    base: {
      ref: "master",
      sha: "45600fe",
      user: { login: "username" },
      repo: {
        name: "repository",
        full_name: "username/repository",
        owner: { login: "username" }
      }
    }
  };
}

module.exports = { pullRequest };

function branchName(ref) {
  const branchPrefix = "refs/heads/";
  if (ref.startsWith(branchPrefix)) {
    return ref.substr(branchPrefix.length);
  }
}

module.exports = { branchName };

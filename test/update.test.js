const { NeutralExitError } = require("../lib/common");
const { update } = require("../lib/update");
const { pullRequest } = require("./common");

test("update will only change branches from the same repository", async () => {
  const pr = pullRequest();
  pr.head.repo.full_name = "other/repository";
  await expect(update({ config: {} }, "", "", pr)).rejects.toEqual(
    new NeutralExitError()
  );
});

const { update } = require("../lib/update");
const { pullRequest } = require("./common");

test("update will only run when a label is set", async () => {
  const pr = pullRequest();
  expect(await update({ config: { updateLabel: "" } }, pr)).toEqual(false);
});

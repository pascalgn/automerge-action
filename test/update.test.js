const { update } = require("../lib/update");
const { createConfig } = require("../lib/common");
const { pullRequest } = require("./common");

test("update will only run when the label matches", async () => {
  const pr = pullRequest();
  const config = createConfig({ UPDATE_LABELS: "none" });
  expect(await update({ config }, pr)).toEqual(false);
});

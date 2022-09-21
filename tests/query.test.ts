import { handler } from "../lambdas/query_post";
import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

test("Runs Query as expected", async () => {
  await handler({
    body: JSON.stringify({
      graph: "roam-depot-developers",
      query:
        '[:find (pull ?b [:block/uid]) :where  [?t :node/title "David Vargas"] [?b :block/refs ?t] ]',
    }),
    headers: {
      Authorization: `Bearer ${process.env.ROAM_API_TOKEN}`,
    },
  }).then((r) => {
    expect(r.statusCode).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    const parsed = JSON.parse(r.body);
    expect(Object.keys(parsed)).toEqual(["result"]);
    const [[first]] = parsed.result;
    expect(first).toHaveProperty(":block/uid");
    const sortedUids = parsed.result.map((a) => a[0][":block/uid"]).sort();
    expect(sortedUids.slice(0, 3)).toEqual([
      "-dvtTpP8-",
      "6K4UAxmd8",
      "7RFBXbCCS",
    ]);
  });
});

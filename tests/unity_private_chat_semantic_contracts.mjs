import assert from "node:assert/strict";
import path from "node:path";

import { runPrivateChatSemanticSamples } from "../scripts/unity_private_chat_semantic_samples.mjs";

const report = await runPrivateChatSemanticSamples({
  outputRoot: path.join("output", "unity-private-chat-semantic-contracts"),
  llmRenderer: true,
  llmProvider: "mock",
  assertPass: true,
});

assert.equal(report.rows.length, 8, "semantic contract should cover the fixed eight private chat samples");
assert.equal(report.passed, 8, "all fixed private chat samples should pass");
for (const row of report.rows) {
  assert.equal(row.outgoingPreserved, true, `${row.id} should preserve outgoing text and intent`);
  assert.ok(row.aiRawReply, `${row.id} should record deterministic draft`);
  assert.ok(row.llmFinal, `${row.id} should record LLM final text`);
  assert.notEqual(row.llmSource, "missing", `${row.id} should record LLM source or fallback source`);
}

console.log("unity private chat semantic contracts ok");

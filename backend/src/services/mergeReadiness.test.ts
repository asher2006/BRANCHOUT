import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMergeReadiness } from "./mergeReadiness.js";

test("reports no PR when no pull request exists", () => {
  assert.equal(evaluateMergeReadiness({ prStatus: "none", behindBy: 0, mergeable: null, checks: "unknown" }), "no_pr");
});

test("prioritizes merged and draft states", () => {
  assert.equal(evaluateMergeReadiness({ prStatus: "merged", behindBy: 10, mergeable: false, checks: "failing" }), "merged");
  assert.equal(evaluateMergeReadiness({ prStatus: "draft", behindBy: 0, mergeable: true, checks: "passing" }), "draft");
});

test("requires a rebase when the PR is behind the base branch", () => {
  assert.equal(evaluateMergeReadiness({ prStatus: "open", behindBy: 2, mergeable: true, checks: "passing" }), "needs_rebase");
});

test("surfaces failing and pending checks", () => {
  assert.equal(evaluateMergeReadiness({ prStatus: "open", behindBy: 0, mergeable: true, checks: "failing" }), "checks_failing");
  assert.equal(evaluateMergeReadiness({ prStatus: "open", behindBy: 0, mergeable: true, checks: "pending" }), "checks_pending");
});

test("marks a clean PR ready to merge", () => {
  assert.equal(evaluateMergeReadiness({ prStatus: "open", behindBy: 0, mergeable: true, checks: "passing" }), "ready");
});

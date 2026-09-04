import assert from "node:assert/strict";
import test from "node:test";
import { safeThreshold, validateProjectTeammates } from "./validation.js";

const teammate = (name: string, username: string, paths: string[]) => ({
  name,
  github_username: username,
  task_description: `${name}'s task`,
  owned_paths: paths,
});

test("accepts distinct teammates with isolated paths", () => {
  const result = validateProjectTeammates([
    teammate("Ada", "ada-dev", ["frontend/components/"]),
    teammate("Lin", "lin-dev", ["backend/routes/"]),
  ]);

  assert.ok("teammates" in result);
  if ("teammates" in result) assert.equal(result.teammates[0].ownedPaths[0], "frontend/components");
});

test("rejects duplicate usernames and overlapping paths", () => {
  const duplicate = validateProjectTeammates([
    teammate("Ada", "ada-dev", ["frontend/"]),
    teammate("Grace", "ada-dev", ["backend/"]),
  ]);
  assert.ok("error" in duplicate);

  const overlap = validateProjectTeammates([
    teammate("Ada", "ada-dev", ["frontend/"]),
    teammate("Grace", "grace-dev", ["frontend/components/"]),
  ]);
  assert.ok("error" in overlap);
});

test("rejects unsafe paths and bounds stale thresholds", () => {
  const unsafe = validateProjectTeammates([teammate("Ada", "ada-dev", ["../secrets/"])]);
  assert.ok("error" in unsafe);
  assert.equal(safeThreshold("100"), 24);
  assert.equal(safeThreshold("not-a-number"), 3);
});

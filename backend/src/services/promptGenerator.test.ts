import assert from "node:assert/strict";
import test from "node:test";
import { generateMasterPrompt } from "./promptGenerator.js";

test("generates a complete, isolated task prompt", () => {
  const prompt = generateMasterPrompt({
    projectName: "demo-project",
    projectDescription: "A hackathon MVP",
    techStack: "TypeScript, React",
    githubRepoUrl: "https://github.com/example/demo-project.git",
    teammate: {
      id: 1,
      name: "Ada",
      github_username: "ada-dev",
      task_description: "Build the dashboard feature.",
      branch_name: "dashboard-ada-dev",
      owned_paths: ["src/frontend/dashboard/"],
    },
    allTeammates: [
      {
        id: 1,
        name: "Ada",
        github_username: "ada-dev",
        task_description: "Build the dashboard feature.",
        branch_name: "dashboard-ada-dev",
        owned_paths: ["src/frontend/dashboard/"],
      },
      {
        id: 2,
        name: "Lin",
        github_username: "lin-dev",
        task_description: "Build the API feature.",
        branch_name: "api-lin-dev",
        owned_paths: ["src/backend/api/"],
      },
    ],
  });

  assert.match(prompt, /Your Assigned Task & Complete Implementation Plan/);
  assert.match(prompt, /This prompt covers \*\*only Ada's assigned task\*\*/);
  assert.match(prompt, /Required execution checklist/);
  assert.match(prompt, /Do not implement, copy, or merge another teammate's task/);
  assert.match(prompt, /git add -- 'src\/frontend\/dashboard\/'/);
  assert.doesNotMatch(prompt, /git add \./);
  assert.doesNotMatch(prompt, /git merge dashboard-ada-dev/);
  assert.match(prompt, /lin-dev.*src\/backend\/api/);
});

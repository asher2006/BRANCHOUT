export interface ProjectTeammateInput {
  name?: unknown;
  github_username?: unknown;
  task_description?: unknown;
  owned_paths?: unknown;
}

export interface ValidatedTeammate {
  name: string;
  githubUsername: string;
  taskDescription: string;
  ownedPaths: string[];
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function pathsOverlap(first: string, second: string): boolean {
  return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}

export function validateProjectTeammates(value: unknown):
  | { teammates: ValidatedTeammate[] }
  | { error: string } {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    return { error: "Provide between 1 and 12 teammates." };
  }

  const teammates: ValidatedTeammate[] = [];
  const usernames = new Set<string>();

  for (const raw of value as ProjectTeammateInput[]) {
    if (!raw || typeof raw !== "object") {
      return { error: "Each teammate must be an object." };
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const githubUsername = typeof raw.github_username === "string"
      ? raw.github_username.trim().replace(/^@/, "").toLowerCase()
      : "";
    const taskDescription = typeof raw.task_description === "string" ? raw.task_description.trim() : "";
    const rawPaths = Array.isArray(raw.owned_paths) ? raw.owned_paths : [];

    if (!name || !githubUsername || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(githubUsername)) {
      return { error: "Every teammate needs a name and a valid GitHub username." };
    }
    if (!taskDescription) return { error: `Add a task description for ${name}.` };
    if (usernames.has(githubUsername)) return { error: "GitHub usernames must be unique within a project." };

    const ownedPaths = [...new Set(rawPaths.map((path) => normalizePath(String(path))))];
    if (ownedPaths.length === 0 || ownedPaths.some((path) => !path || path.startsWith("/") || path.includes(".."))) {
      return { error: `Assign ${name} at least one safe, relative owned path.` };
    }

    usernames.add(githubUsername);
    teammates.push({ name, githubUsername, taskDescription, ownedPaths });
  }

  for (let index = 0; index < teammates.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < teammates.length; compareIndex += 1) {
      const first = teammates[index];
      const second = teammates[compareIndex];
      const conflict = first.ownedPaths.find((path) => second.ownedPaths.some((other) => pathsOverlap(path, other)));
      if (conflict) return { error: `Owned path conflict between ${first.name} and ${second.name}: ${conflict}` };
    }
  }

  return { teammates };
}

export function safeThreshold(value: unknown, fallback = 3): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? Math.min(24, Math.max(0.25, parsed)) : fallback;
}

export interface PromptContext {
  projectName: string;
  projectDescription?: string;
  techStack?: string;
  sharedConventions?: string;
  githubRepoUrl?: string | null;
  teammate: {
    id: number;
    name: string;
    github_username: string;
    task_description: string;
    branch_name: string;
    owned_paths: string[];
  };
  allTeammates: Array<{
    id: number;
    name: string;
    github_username: string;
    task_description: string;
    branch_name: string;
    owned_paths: string[];
  }>;
}

/**
 * Generates a structured master prompt for a specific teammate
 * to paste directly into their coding agent (Claude Code, Cursor, etc.).
 * No LLM API is used — this is deterministic string templating.
 */
export function generateMasterPrompt(ctx: PromptContext): string {
  const { projectName, projectDescription, techStack, sharedConventions, githubRepoUrl, teammate, allTeammates } = ctx;

  const otherTeammates = allTeammates.filter((t) => t.id !== teammate.id);

  const sections: string[] = [];

  // Header / Role
  sections.push(`# Master Prompt: ${projectName} — ${teammate.name} (@${teammate.github_username})`);
  sections.push(`> You are an expert AI software engineer assisting **${teammate.name}** (@${teammate.github_username}) in a fast-paced hackathon. Follow the instructions and boundaries below strictly.`);

  // Project Overview
  sections.push(`\n## 1. Project Overview\n- **Project Name:** ${projectName}`);
  if (projectDescription?.trim()) {
    sections.push(`- **Description:** ${projectDescription.trim()}`);
  }
  if (techStack?.trim()) {
    sections.push(`- **Tech Stack:** ${techStack.trim()}`);
  }
  if (githubRepoUrl?.trim()) {
    sections.push(`- **GitHub Repository:** ${githubRepoUrl.trim()}`);
  }

  // Teammate's Assigned Task
  sections.push(`\n## 2. Your Assigned Task & Goal`);
  if (teammate.task_description?.trim()) {
    sections.push(`**Task Objective:**\n${teammate.task_description.trim()}`);
  } else {
    sections.push(`**Task Objective:** Implement your assigned feature module for the hackathon MVP.`);
  }

  // Git Branch & Workspace Boundaries
  sections.push(`\n## 3. Git Branch & Ownership Boundaries`);
  sections.push(`- **Working Branch:** \`${teammate.branch_name}\``);
  sections.push(`- **Base / Target Branch:** \`main\``);

  if (teammate.owned_paths.length > 0) {
    sections.push(`- **Your Owned Paths (You have full write authority here):**`);
    for (const p of teammate.owned_paths) {
      sections.push(`  - \`${p}\``);
    }
  } else {
    sections.push(`- **Your Owned Paths:** Work within feature folders relevant to your task.`);
  }

  // Other Teammates' Boundaries (Conflict Prevention)
  if (otherTeammates.length > 0) {
    sections.push(`\n### ⛔ Team Isolation Rules (Prevent Merge Conflicts)`);
    sections.push(`Other teammates are building concurrently on their own branches. **DO NOT modify, delete, or reformat files owned by other teammates** unless explicitly coordinated:`);
    for (const other of otherTeammates) {
      const paths = other.owned_paths.length > 0 ? other.owned_paths.map((p) => `\`${p}\``).join(', ') : '*(None specified)*';
      sections.push(`- **${other.name}** (@${other.github_username}) on \`${other.branch_name}\` owns: ${paths}`);
    }
  }

  // Shared Conventions
  sections.push(`\n## 4. Shared Team Conventions & Standards`);
  if (sharedConventions?.trim()) {
    sections.push(`Follow these team conventions defined in \`SHARED_CONVENTIONS.md\`:\n\n${sharedConventions.trim()}`);
  } else {
    sections.push(`- Write clean, modular, self-documenting code.`);
    sections.push(`- Write tests where practical for core logic.`);
    sections.push(`- Follow standard naming and formatting conventions for the project's language.`);
  }

  // Execution & Delivery Instructions
  sections.push(`\n## 5. Development Workflow`);
  sections.push(`1. **Verify your branch:** Ensure you are working on branch \`${teammate.branch_name}\`.`);
  sections.push(`2. **Implement incrementally:** Build the feature in small, well-tested steps.`);
  sections.push(`3. **Commit often:** Use clear commit messages (e.g. \`feat(auth): implement token verification\`).`);
  sections.push(`4. **Push & PR:** When your feature is complete and verified locally, push to \`${teammate.branch_name}\` and open a Pull Request into \`main\`.`);

  return sections.join('\n');
}

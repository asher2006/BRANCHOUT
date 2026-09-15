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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function taskCommitLabel(taskDescription: string): string {
  const label = taskDescription
    .split(/\r?\n/, 1)[0]
    .replace(/^#+\s*/, '')
    .replace(/[^a-zA-Z0-9:_ -]/g, '')
    .trim()
    .slice(0, 50);
  return label || 'assigned feature';
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
  sections.push(`\n## 2. Your Assigned Task & Complete Implementation Plan`);
  sections.push(`This prompt covers **only ${teammate.name}'s assigned task**. Complete the plan below in order. Do not combine it with another teammate's task, take over their implementation, or edit files outside your declared ownership.`);
  if (teammate.task_description?.trim()) {
    sections.push(`**Task Objective and Required Work:**\n${teammate.task_description.trim()}`);
  } else {
    sections.push(`**Task Objective:** Implement your assigned feature module for the hackathon MVP. First inspect the repository, then define the smallest interface needed for integration, implement the feature, cover error and empty states, add focused tests, and verify the final diff.`);
  }

  sections.push(`\n### Required execution checklist`);
  sections.push(`1. Read the repository README and \`SHARED_CONVENTIONS.md\`; inspect existing code before creating files.`);
  sections.push(`2. Map every planned change to one of your owned paths. If a required change is outside those paths, stop and report the exact dependency instead of editing it.`);
  sections.push(`3. Implement only this task, including validation, loading/empty/error behavior, and the integration contract relevant to the feature. Do not implement, copy, or merge another teammate's task.`);
  sections.push(`4. Add or update focused tests inside your owned paths and run the repository's relevant formatter, linter, type-checker, and test commands.`);
  sections.push(`5. Run \`git diff --check\`, inspect \`git status --short\`, and confirm every changed file is within your owned paths before committing.`);
  sections.push(`6. Prepare a handoff with changed files, verification commands, integration notes, and any known limitations.`);

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
    sections.push(`\n> 🚨 **HARD CI CONSTRAINT:** A GitHub Actions CI \`boundary-check\` runs on every pull request targeting \`main\`. If your PR touches ANY file outside your declared owned paths (or allowed \`shared_paths\`), the CI check will fail, comment on the PR with the offending files, and block merging into \`main\`. Treat these boundaries as hard constraints.`);
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
  sections.push(`\n## 5. Development & Git Workflow`);
  sections.push(`1. **Clone & Checkout Your Dedicated Branch:**`);
  if (githubRepoUrl?.trim()) {
    sections.push(`   \`\`\`bash`);
    sections.push(`   git clone ${githubRepoUrl.trim().replace(/\.git$/, '')}.git`);
    sections.push(`   cd ${projectName}`);
    sections.push(`   git checkout -b ${teammate.branch_name}`);
    sections.push(`   \`\`\``);
  } else {
    sections.push(`   \`\`\`bash\ngit checkout -b ${teammate.branch_name}\n\`\`\``);
  }
  sections.push(`2. **Build Within Your Boundaries:** Work strictly inside your assigned paths. Automated CI (\`boundary-check\`) will fail and block your PR if files outside your owned paths are changed. Do not modify or merge another teammate's task.`);
  sections.push(`3. **Verify Before Committing:** Check the diff and confirm no out-of-scope files were changed.`);
  sections.push(`4. **Push Changes to Your Branch:**`);
  sections.push(`   \`\`\`bash`);
  const ownedPathArgs = teammate.owned_paths.length > 0
    ? teammate.owned_paths.map(shellQuote).join(' ')
    : '';
  sections.push(`   git add -- ${ownedPathArgs || '<your-owned-path>'}`);
  sections.push(`   git commit -m "feat: complete ${taskCommitLabel(teammate.task_description || '')}"`);
  sections.push(`   git push -u origin ${teammate.branch_name}`);
  sections.push(`   \`\`\``);
  sections.push(`5. **Open a Pull Request:**`);
  if (githubRepoUrl?.trim()) {
    sections.push(`   - Open Pull Request: ${githubRepoUrl.trim().replace(/\.git$/, '')}/compare/main...${teammate.branch_name}?expand=1`);
  }
  sections.push(`   - Include the handoff summary and verification results. A maintainer merges the PR after the boundary check and review pass.`);
  sections.push(`   - Do not merge another teammate's branch into yours or push directly to \`main\`.`);

  return sections.join('\n');
}

export interface TeammateAllocation {
  name: string;
  githubUsername: string;
  taskDescription: string;
  ownedPaths: string[];
  branchName: string;
}

export interface ProjectDecomposition {
  projectName: string;
  description: string;
  techStack: string;
  sharedConventions: string;
  teammates: TeammateAllocation[];
}

export interface DecomposeOptions {
  teamName?: string;
  ideaPrompt: string;
  teamSize?: number;
  teammateRoles?: Array<{ name?: string; role?: string; githubUsername?: string }>;
}

/**
 * Keeps the offline path useful too: a teammate receives an executable brief,
 * not only a role label. The same shape is requested from external models.
 */
function buildTaskBrief(title: string, area: string, ownedPaths: string[]): string {
  const paths = ownedPaths.map((path) => `\`${path}\``).join(', ');

  return `### Objective
  Deliver the assigned ${title.toLowerCase()} for the ${area} hackathon MVP.

### Required implementation steps
1. Read the repository README and SHARED_CONVENTIONS.md, inspect the existing code, and identify the smallest integration surface for this feature.
2. Create or update the implementation only inside these owned paths: ${paths}.
3. Implement the complete feature, including its normal flow, validation, loading/empty states, and failure handling where applicable.
4. Keep the public interface easy for the rest of the team to consume. Document expected inputs, outputs, events, or API contracts in your owned code when integration details are not obvious.
5. Add focused tests for the important success and failure cases, following the repository's existing test conventions.
6. Run the relevant formatter, linter, type-checker, and tests; fix failures caused by your changes.
7. Review the final diff and prepare a short handoff describing what changed, how to use it, and any integration assumption.

### Acceptance criteria
- The feature works end to end within its declared scope and is usable by the MVP.
- Invalid, empty, loading, and error cases are handled where the feature can encounter them.
- Tests cover the core behavior and pass locally.
- No files outside the owned paths are changed.

### Out of scope
- Do not implement, copy, or merge another teammate's task.
- Do not edit another teammate's owned paths or shared project files to make integration easier; record the required contract and notify the coordinator instead.`;
}

function ensureCompleteTaskBrief(taskDescription: unknown, ownedPaths: unknown, fallbackTitle = 'assigned feature'): string {
  const title = typeof taskDescription === 'string' && taskDescription.trim()
    ? taskDescription.trim()
    : fallbackTitle;
  const paths = Array.isArray(ownedPaths)
    ? ownedPaths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    : [];

  // Preserve a tailored model response, but repair short responses so every
  // provider (and older saved project) still produces a complete prompt.
  if (title.length >= 220 && /implementation steps|acceptance criteria|out of scope/i.test(title)) {
    return title;
  }

  return buildTaskBrief(title, 'project', paths);
}

/**
 * Intelligent Semantic Architecture Engine
 * Analyzes problem keywords and synthesizes a non-overlapping, conflict-free architecture
 * used directly or as a high-reliability fallback when external LLM APIs are unreachable.
 */
function heuristicDecompose(options: DecomposeOptions): ProjectDecomposition {
  const prompt = options.ideaPrompt.toLowerCase();
  const teamSize = Math.max(2, Math.min(6, options.teamSize || 3));

  // Domain detection
  let domain = 'fullstack';
  let projectName = 'hackathon-project';
  let techStack = 'TypeScript, React, Node.js, Express, SQLite';

  if (options.teamName && options.teamName.trim()) {
    projectName = options.teamName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  } else if (prompt.includes('whiteboard') || prompt.includes('canvas') || prompt.includes('draw') || prompt.includes('realtime') || prompt.includes('collab')) {
    domain = 'collaborative_canvas';
    projectName = 'collab-canvas';
    techStack = 'React, TypeScript, Canvas API, WebSockets, Node.js';
  } else if (prompt.includes('ai') || prompt.includes('agent') || prompt.includes('bot') || prompt.includes('llm') || prompt.includes('copilot')) {
    domain = 'ai_agent';
    projectName = 'agent-hub';
    techStack = 'Next.js, Python/FastAPI, LangChain, Vector DB, Tailwind';
  } else if (prompt.includes('health') || prompt.includes('habit') || prompt.includes('fitness') || prompt.includes('tracker')) {
    domain = 'health_tracker';
    projectName = 'pulse-tracker';
    techStack = 'React Native, TypeScript, Node.js, Express, PostgreSQL';
  } else if (prompt.includes('devops') || prompt.includes('incident') || prompt.includes('monitor') || prompt.includes('cloud')) {
    domain = 'devops_tool';
    projectName = 'incident-ops';
    techStack = 'Go, React, Docker, OpenTelemetry, SQLite';
  } else if (prompt.includes('finance') || prompt.includes('crypto') || prompt.includes('wallet') || prompt.includes('budget')) {
    domain = 'fintech';
    projectName = 'ledger-flow';
    techStack = 'React, TypeScript, Node.js, Plaid API, PostgreSQL';
  } else {
    // Generate slug from first 3 words of prompt
    const words = options.ideaPrompt.trim().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 3);
    if (words.length > 0 && words[0]) {
      projectName = words.join('-').toLowerCase();
    }
  }

  // Generate Shared Conventions
  const sharedConventions = `# Shared Engineering Conventions: ${projectName}

## 1. Directory Layout & Architecture
- \`src/frontend/\`: Client user interface, views, and state management.
- \`src/backend/routes/\`: RESTful API route definitions and endpoint handlers.
- \`src/backend/services/\`: Business logic, domain algorithms, and external integrations.
- \`src/types/\`: Shared TypeScript interfaces and data models.

## 2. API & Data Contracts
- Standard JSON response format: \`{ "success": boolean, "data": any, "error"?: string }\`
- HTTP 200/201 for successes, HTTP 400 for bad payloads, HTTP 500 for unhandled exceptions.

## 3. Git Branching & Isolation Rules
- Never commit directly to \`main\`.
- Teammates work exclusively inside their designated owned file paths.
- Before opening a Pull Request, rebase with latest \`main\` and ensure linting passes.
`;

  // Default teammate names
  const defaultNames = ['Alice', 'Bob', 'Charlie', 'Dana', 'Evan', 'Fiona'];
  const defaultGithubs = ['alice-dev', 'bob-builder', 'charlie-eng', 'dana-coder', 'evan-tech', 'fiona-hacks'];

  // Role distribution templates per domain
  const allocations: TeammateAllocation[] = [];

  if (domain === 'collaborative_canvas') {
    const roles = [
      {
        title: 'Interactive Drawing Canvas & Rendering Engine',
        slug: 'canvas-engine',
        paths: ['src/frontend/canvas/', 'src/frontend/tools/'],
      },
      {
        title: 'Real-Time WebSocket Sync & Room Management',
        slug: 'websocket-sync',
        paths: ['src/backend/realtime/', 'src/backend/rooms/'],
      },
      {
        title: 'User Collaboration Presence & Cursor Overlay',
        slug: 'presence-cursor',
        paths: ['src/frontend/presence/', 'src/frontend/components/cursors/'],
      },
      {
        title: 'Export, Snapshots & Persistent Board Storage',
        slug: 'board-persistence',
        paths: ['src/backend/storage/', 'src/backend/export/'],
      },
      {
        title: 'Chat, Voice & Participant Sidebar',
        slug: 'collab-sidebar',
        paths: ['src/frontend/sidebar/', 'src/frontend/components/chat/'],
      },
      {
        title: 'Authentication & Board Access Permissions',
        slug: 'auth-permissions',
        paths: ['src/backend/auth/', 'src/backend/middleware/'],
      },
    ];

    for (let i = 0; i < teamSize; i++) {
      const name = options.teammateRoles?.[i]?.name || defaultNames[i];
      const gh = options.teammateRoles?.[i]?.githubUsername || defaultGithubs[i];
      const role = roles[i % roles.length];
      allocations.push({
        name,
        githubUsername: gh,
        taskDescription: buildTaskBrief(role.title, domain, role.paths),
        ownedPaths: role.paths,
        branchName: `${role.slug}-${gh}`,
      });
    }
  } else if (domain === 'ai_agent') {
    const roles = [
      {
        title: 'Agent Workflow Orchestration & Tool Execution',
        slug: 'agent-orchestrator',
        paths: ['src/backend/agents/', 'src/backend/tools/'],
      },
      {
        title: 'Chat Interface & Streaming Response UI',
        slug: 'chat-interface',
        paths: ['src/frontend/chat/', 'src/frontend/components/stream/'],
      },
      {
        title: 'Vector Knowledge Ingestion & Retrieval Pipeline',
        slug: 'vector-rag',
        paths: ['src/backend/rag/', 'src/backend/embeddings/'],
      },
      {
        title: 'Telemetry, Prompt Tracing & Cost Monitoring',
        slug: 'telemetry-dashboard',
        paths: ['src/frontend/metrics/', 'src/backend/telemetry/'],
      },
      {
        title: 'Session History & Conversation Persistence',
        slug: 'session-history',
        paths: ['src/backend/sessions/', 'src/backend/db/'],
      },
      {
        title: 'API Authentication & Rate Limiter',
        slug: 'api-security',
        paths: ['src/backend/security/', 'src/backend/middleware/'],
      },
    ];

    for (let i = 0; i < teamSize; i++) {
      const name = options.teammateRoles?.[i]?.name || defaultNames[i];
      const gh = options.teammateRoles?.[i]?.githubUsername || defaultGithubs[i];
      const role = roles[i % roles.length];
      allocations.push({
        name,
        githubUsername: gh,
        taskDescription: buildTaskBrief(role.title, domain, role.paths),
        ownedPaths: role.paths,
        branchName: `${role.slug}-${gh}`,
      });
    }
  } else {
    // General Full-Stack Partitioning
    const roles = [
      {
        title: 'Client Web UI Layout & Primary Dashboard',
        slug: 'frontend-dashboard',
        paths: ['src/frontend/views/', 'src/frontend/components/'],
      },
      {
        title: 'Core API Endpoints & Business Logic Service',
        slug: 'backend-api',
        paths: ['src/backend/routes/', 'src/backend/services/'],
      },
      {
        title: 'Data Modeling, Database Schema & Migrations',
        slug: 'database-layer',
        paths: ['src/backend/models/', 'src/backend/database/'],
      },
      {
        title: 'User Authentication, Profiles & Session Guard',
        slug: 'auth-profiles',
        paths: ['src/backend/auth/', 'src/frontend/auth/'],
      },
      {
        title: 'External API Integrations & Webhooks',
        slug: 'integrations-service',
        paths: ['src/backend/integrations/', 'src/backend/webhooks/'],
      },
      {
        title: 'Automated Testing Suite & CI Scaffolding',
        slug: 'testing-infrastructure',
        paths: ['tests/', 'src/testing/'],
      },
    ];

    for (let i = 0; i < teamSize; i++) {
      const name = options.teammateRoles?.[i]?.name || defaultNames[i];
      const gh = options.teammateRoles?.[i]?.githubUsername || defaultGithubs[i];
      const role = roles[i % roles.length];
      allocations.push({
        name,
        githubUsername: gh,
        taskDescription: buildTaskBrief(role.title, domain, role.paths),
        ownedPaths: role.paths,
        branchName: `${role.slug}-${gh}`,
      });
    }
  }

  return {
    projectName,
    description: options.ideaPrompt.trim(),
    techStack,
    sharedConventions,
    teammates: allocations,
  };
}

function cleanAndParseJson(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown code block fences if present
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {}
    }
    // Fallback: extract between first '{' and last '}'
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Unable to parse JSON from AI response');
  }
}

async function callGroq(apiKey: string, systemInstruction: string, prompt: string, teamSize: number): Promise<ProjectDecomposition | null> {
  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'llama-3.3-70b-versatile'];
  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Problem Statement: "${prompt}"\nTeam Size: ${teamSize}` },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = cleanAndParseJson(content);
          if (parsed.projectName && Array.isArray(parsed.teammates)) {
            console.log(`Successfully generated architecture via Groq (${model})`);
            return parsed;
          }
        }
      } else {
        console.warn(`Groq model ${model} returned status: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Error trying Groq model ${model}:`, e);
    }
  }
  return null;
}

function applyUserOverrides(result: ProjectDecomposition, options: DecomposeOptions): ProjectDecomposition {
  result.teammates = (Array.isArray(result.teammates) ? result.teammates : []).map((tm) => ({
    ...tm,
    taskDescription: ensureCompleteTaskBrief(tm.taskDescription, tm.ownedPaths, tm.name || 'assigned feature'),
  }));

  if (options.teamName && options.teamName.trim()) {
    result.projectName = options.teamName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (options.teammateRoles && Array.isArray(options.teammateRoles)) {
    result.teammates = result.teammates.map((tm, idx) => {
      const userTm = options.teammateRoles?.[idx];
      if (!userTm) return tm;
      const name = userTm.name?.trim() || tm.name;
      const gh = userTm.githubUsername?.trim() || tm.githubUsername;
      const taskSlug = tm.branchName.replace(new RegExp(`-${tm.githubUsername}$`), '');
      return {
        ...tm,
        name,
        githubUsername: gh,
        branchName: `${taskSlug}-${gh}`,
      };
    });
  }
  return result;
}

/**
 * Calls an external LLM (xAI Grok, Groq, Gemini, OpenAI) if configured via environment variables.
 * Otherwise uses the built-in Intelligent Semantic Architecture Engine.
 */
export async function decomposeProblemStatement(options: DecomposeOptions): Promise<ProjectDecomposition> {
  const grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const teamSize = options.teamSize || 3;

  const systemInstruction = `You are Branchout's Lead Hackathon Architect.
Given a hackathon problem statement/idea, decompose it into a clean, conflict-free project plan.
CRITICAL RULES:
1. "projectName": URL-safe lowercase slug with hyphens (max 30 chars).
2. "description": 1-2 sentence compelling summary of the hackathon build.
3. "techStack": Comma-separated list of recommended technologies (e.g. "React, Node.js, Express, SQLite").
4. "sharedConventions": Markdown formatted shared conventions covering folder structure, API design standards, and Git rules.
5. "teammates": An array of EXACTLY ${teamSize} teammates with:
   - "name": Teammate name.
   - "githubUsername": Realistic GitHub handle (e.g. alice-dev).
   - "taskDescription": A standalone implementation brief, not a short title. It MUST contain: a one-sentence objective; 5-8 numbered, concrete implementation steps; relevant inputs/outputs, UI/API/data contracts, or integration assumptions; 3-6 acceptance criteria; tests to write/run; and an explicit out-of-scope list. Tailor every detail to this project and the assigned feature. The person must be able to complete the task from this field without asking what to do next.
   - "ownedPaths": Array of 1-3 directory paths (e.g. ["src/frontend/canvas/"]).
     IMPORTANT: Paths MUST BE COMPLETELY NON-OVERLAPPING across teammates. Never assign a parent path to one person and child path to another!
   - "branchName": Slug format "<task-slug>-<github_username>".
6. Every teammate must have one distinct feature. Tasks must not merge or duplicate each other. If a feature needs another teammate's output, describe the exact interface and integration assumption, but do not assign or implement that other feature twice.
7. Keep each task fully inside its owned paths. Do not rely on editing shared files or another teammate's paths; mention any coordinator-owned integration step as an explicit dependency.

QUALITY BAR FOR taskDescription:
- Write instructions for the assigned person, using direct action verbs.
- Include normal, empty/loading, validation, and error behavior where relevant.
- Include a concrete definition of done and a focused verification plan.
- When the problem statement omits a detail, make a reasonable MVP assumption and state it in the task's integration assumptions instead of leaving a gap.
- Do not return vague labels such as "build the dashboard" or "handle the backend".

Respond ONLY with valid JSON matching this schema:
{
  "projectName": string,
  "description": string,
  "techStack": string,
  "sharedConventions": string,
  "teammates": [
    {
      "name": string,
      "githubUsername": string,
      "taskDescription": string,
      "ownedPaths": string[],
      "branchName": string
    }
  ]
}`;

  let userPrompt = `Problem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}`;
  if (options.teamName && options.teamName.trim()) {
    userPrompt += `\nTeam / Project Name: "${options.teamName.trim()}" (derive projectName slug from this)`;
  }
  if (options.teammateRoles && options.teammateRoles.length > 0) {
    const members = options.teammateRoles
      .slice(0, teamSize)
      .map((m, i) => `  - Member ${i + 1}: Name="${m.name || `Member ${i + 1}`}", GitHub Handle="${m.githubUsername || `member-${i + 1}`}"`)
      .join('\n');
    userPrompt += `\nTeam Member Details:\n${members}\nAssign distinct, non-overlapping tasks and paths specifically to these ${teamSize} members.`;
  }

  // 1. Try Grok / Groq API if key is present
  if (grokApiKey) {
    if (grokApiKey.startsWith('gsk_')) {
      const groqResult = await callGroq(grokApiKey, systemInstruction, userPrompt, teamSize);
      if (groqResult) return applyUserOverrides(groqResult, options);
    } else {
      // Standard xAI Grok API
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${grokApiKey}`,
          },
          body: JSON.stringify({
            model: 'grok-2-latest',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = cleanAndParseJson(content);
            if (parsed.projectName && Array.isArray(parsed.teammates)) {
              console.log('Successfully generated architecture via xAI Grok');
              return applyUserOverrides(parsed, options);
            }
          }
        }
      } catch (err) {
        console.warn('xAI Grok API call failed:', err);
      }
    }
  }

  // 2. Try separate GROQ_API_KEY if present
  if (groqApiKey) {
    const groqResult = await callGroq(groqApiKey, systemInstruction, userPrompt, teamSize);
    if (groqResult) return applyUserOverrides(groqResult, options);
  }

  // 3. Try Google Gemini API if key is present
  if (geminiApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${systemInstruction}\n\n${userPrompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = cleanAndParseJson(rawText);
          if (parsed.projectName && Array.isArray(parsed.teammates)) {
            console.log('Successfully generated architecture via Google Gemini');
            return applyUserOverrides(parsed, options);
          }
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed:', err);
    }
  }

  // 4. Try OpenAI API if key is present
  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = cleanAndParseJson(content);
          if (parsed.projectName && Array.isArray(parsed.teammates)) {
            console.log('Successfully generated architecture via OpenAI');
            return applyUserOverrides(parsed, options);
          }
        }
      }
    } catch (err) {
      console.warn('OpenAI API call failed:', err);
    }
  }

  // Built-in intelligent fallback engine
  console.log('Using built-in Semantic Architecture Engine');
  return applyUserOverrides(heuristicDecompose(options), options);
}

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
  ideaPrompt: string;
  teamSize?: number;
  teammateRoles?: Array<{ name?: string; role?: string; githubUsername?: string }>;
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

  if (prompt.includes('whiteboard') || prompt.includes('canvas') || prompt.includes('draw') || prompt.includes('realtime') || prompt.includes('collab')) {
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
        taskDescription: role.title,
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
        taskDescription: role.title,
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
        taskDescription: role.title,
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
   - "taskDescription": Clear, focused feature or component to build.
   - "ownedPaths": Array of 1-3 directory paths (e.g. ["src/frontend/canvas/"]).
     IMPORTANT: Paths MUST BE COMPLETELY NON-OVERLAPPING across teammates. Never assign a parent path to one person and child path to another!
   - "branchName": Slug format "<task-slug>-<github_username>".

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

  // 1. Try xAI Grok API if key is present (or if key starts with xai-)
  if (grokApiKey) {
    // If it's a Groq key (starts with gsk_) accidentally passed as GROK_API_KEY
    if (grokApiKey.startsWith('gsk_')) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${grokApiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: `Problem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}` },
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
              console.log('Successfully generated architecture via Groq (Llama 3.3)');
              return parsed;
            }
          }
        }
      } catch (err) {
        console.warn('Groq API call failed:', err);
      }
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
              { role: 'user', content: `Problem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}` },
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
              return parsed;
            }
          }
        } else {
          console.warn('xAI Grok API returned status:', response.status, await response.text());
        }
      } catch (err) {
        console.warn('xAI Grok API call failed:', err);
      }
    }
  }

  // 2. Try Groq API if separate GROQ_API_KEY is present
  if (groqApiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Problem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}` },
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
            console.log('Successfully generated architecture via Groq (Llama 3.3)');
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('Groq API call failed:', err);
    }
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
                    text: `${systemInstruction}\n\nProblem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}`,
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
            return parsed;
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
            { role: 'user', content: `Problem Statement: "${options.ideaPrompt}"\nTeam Size: ${teamSize}` },
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
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('OpenAI API call failed:', err);
    }
  }

  // Built-in intelligent fallback engine
  console.log('Using built-in Semantic Architecture Engine');
  return heuristicDecompose(options);
}

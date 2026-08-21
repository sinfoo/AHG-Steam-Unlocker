---
name: skill-hub
description: Central skill registry that loads and orchestrates all local skills from .claude/skills/ and integrates with external awesome-skill collections for discovery and installation.
---

# Skill Hub — Central Registry & External Collections

## Local Skill Modules (`.claude/skills/`)

All skills reside under `C:\Users\USER\Downloads\filesOPENCODE\.claude\skills\`. Invoke via the `Skill` tool by name.

### Process & Workflow
| Skill | Path | When to Use |
|-------|------|-------------|
| brainstorming | `.claude/skills/brainstorming/SKILL.md` | Before any creative work — explore intent, requirements, design |
| writing-plans | `.claude/skills/writing-plans/SKILL.md` | Given a spec/requirements, write multi-step implementation plan |
| executing-plans | `.claude/skills/executing-plans/SKILL.md` | Execute written plans in separate sessions with review checkpoints |
| dispatching-parallel-agents | `.claude/skills/dispatching-parallel-agents/SKILL.md` | 2+ independent tasks with no shared state/dependencies |
| subagent-driven-development | `.claude/skills/subagent-driven-development/SKILL.md` | Execute plans with independent tasks in current session |
| test-driven-development | `.claude/skills/test-driven-development/SKILL.md` | Before writing implementation code — tests first |
| systematic-debugging | `.claude/skills/systematic-debugging/SKILL.md` | Any bug, test failure, or unexpected behavior |
| receiving-code-review | `.claude/skills/receiving-code-review/SKILL.md` | Receiving code review feedback, before implementing suggestions |
| requesting-code-review | `.claude/skills/requesting-code-review/SKILL.md` | Completing tasks, before merging — verify work meets requirements |
| verification-before-completion | `.claude/skills/verification-before-completion/SKILL.md` | Before claiming work is complete/fixed/passing |
| finishing-a-development-branch | `.claude/skills/finishing-a-development-branch/SKILL.md` | Implementation complete, all tests pass — integrate work |
| skill-creator | `.claude/skills/skill-creator/SKILL.md` | Create new skills, edit, run evals, benchmark, optimize descriptions |
| writing-skills | `.claude/skills/writing-skills/SKILL.md` | Creating new skills, editing existing, verifying before deployment |
| doc-coauthoring | `.claude/skills/doc-coauthoring/SKILL.md` | Write proposals, specs, decision docs, structured content |

### Documents & Files
| Skill | Path | When to Use |
|-------|------|-------------|
| docx | `.claude/skills/docx/SKILL.md` | Create/read/edit/manipulate Word .docx files |
| pdf | `.claude/skills/pdf/SKILL.md` | Extract, merge, split, create, OCR, fill forms in PDFs |
| pptx | `.claude/skills/pptx/SKILL.md` | Create/read/edit .pptx slide decks |
| xlsx | `.claude/skills/xlsx/SKILL.md` | Create/read/edit .xlsx/.csv spreadsheets |
| slack-gif-creator | `.claude/skills/slack-gif-creator/SKILL.md` | Create animated GIFs optimized for Slack |

### Design & Creative
| Skill | Path | When to Use |
|-------|------|-------------|
| algorithmic-art | `.claude/skills/algorithmic-art/SKILL.md` | Generative art with p5.js, seeded randomness, flow fields |
| canvas-design | `.claude/skills/canvas-design/SKILL.md` | Visual art in .png/.pdf — posters, designs, static pieces |
| frontend-design | `.claude/skills/frontend-design/SKILL.md` | Production-grade web UI — components, pages, artifacts |
| impeccable | `.claude/skills/impeccable/SKILL.md` | Design/redesign/critique/audit/polish frontend interfaces |
| web-artifacts-builder | `.claude/skills/web-artifacts-builder/SKILL.md` | Complex claude.ai HTML artifacts with React/Tailwind/shadcn |
| brand-guidelines | `.claude/skills/brand-guidelines/SKILL.md` | Apply brand colors and typography to artifacts |
| design-motion-principles | `.claude/skills/design-motion-principles/SKILL.md` | Audit UI animations, transitions, hover states |
| theme-factory | `.claude/skills/theme-factory/SKILL.md` | Style artifacts with pre-set themes or generate new ones |

### Development & API
| Skill | Path | When to Use |
|-------|------|-------------|
| claude-api | `.claude/skills/claude-api/SKILL.md` | Build/debug/optimize Anthropic SDK apps |
| mcp-builder | `.claude/skills/mcp-builder/SKILL.md` | Create MCP servers for external API integration |
| webapp-testing | `.claude/skills/webapp-testing/SKILL.md` | Test local web apps with Playwright |
| using-git-worktrees | `.claude/skills/using-git-worktrees/SKILL.md` | Start feature work needing isolation from current workspace |

### Communication & Internal
| Skill | Path | When to Use |
|-------|------|-------------|
| internal-comms | `.claude/skills/internal-comms/SKILL.md` | Status reports, newsletters, FAQs, incident reports |
| using-superpowers | `.claude/skills/using-superpowers/SKILL.md` | Start any conversation — find and use skills properly |

### GSD System
| Skill | Path | When to Use |
|-------|------|-------------|
| gsd | `.claude/skills/gsd/SKILL.md` | Full spec-driven development system with 40+ commands |

## External Awesome-Skill Collections

Load a collection, browse its catalog, then install individual skills by referencing the source repo.

### [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)
5,400+ community skills for OpenClaw, filtered and categorized from the official registry.
- **Categories**: Git & GitHub (167), Coding Agents & IDEs (1,184), Browser & Automation (323), Web & Frontend (919), DevOps & Cloud (393), AI & LLMs (176), Data & Analytics (28), Security & Passwords (54), and more.
- **Install**: Follow the skill's README or paste a GitHub repo link into the assistant chat.
- **Source**: Skills published in `github.com/openclaw/skills`

### [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
Curated list of Claude Skills, resources, and tools for Claude AI workflows.
- **Official**: anthropics/skills — docx, pdf, pptx, xlsx, algorithmic-art, canvas-design, slack-gif-creator, frontend-design, web-artifacts-builder, mcp-builder, webapp-testing, brand-guidelines, internal-comms, skill-creator
- **Community**: obra/superpowers (20+ battle-tested skills), expo/skills, trailofbits/skills, shadcn/ui skills, and more.
- **Install via Claude Code**: `/plugin marketplace add anthropics/skills`

### [anthropics/skills](https://github.com/anthropics/skills)
Anthropic's official public repository for Agent Skills.
- **Skills**: Document skills (docx, pdf, pptx, xlsx), Design & Creative, Development & Technical, Enterprise & Communication
- **Try in Claude Code**: `/plugin marketplace add anthropics/skills`
- **Try in Claude API**: Use the `/v1/skills` endpoint
- **Spec**: Includes the Agent Skills specification at `./spec`

### [antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills)
Installable GitHub library of 1,453+ agentic skills for Claude Code, Cursor, Codex CLI, Gemini CLI, Antigravity, OpenCode, Copilot, and more.
- **Install**: `npx antigravity-awesome-skills`
- **Bundles**: SaaS MVP, Full-Stack Developer, Security Engineer, OSS Maintainer, and more
- **Official sources included**: anthropics/skills, openai/skills, microsoft/skills, google-gemini/gemini-skills, expo/skills, huggingface/skills, supabase/agent-skills, vercel-labs/agent-skills, neondatabase/agent-skills, and many more

## How to Use This Skill

1. **For local skills**: Use the `Skill` tool with the skill name from the tables above. The skill at `.claude/skills/<name>/SKILL.md` will be loaded.
2. **To discover external skills**: Fetch one of the awesome-list repos above, browse the categories, and find a relevant skill.
3. **To install an external skill**: Copy the skill folder into `.claude/skills/<name>/` or use the tool-specific install command listed in the collection's README.
4. **To create a new skill**: Use the `skill-creator` or `writing-skills` local skill to scaffold and iterate.

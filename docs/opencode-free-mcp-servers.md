# OpenCode Free MCP Servers — Complete Installation Manual

> **Zero cost. No API keys. Runs 100% locally.**
> This manual covers the 8 best free MCP servers compatible with OpenCode, with step-by-step installation instructions for each one.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [How OpenCode MCP Config Works](#how-opencode-mcp-config-works)
3. [Server 1 — Filesystem](#server-1--filesystem)
4. [Server 2 — Fetch](#server-2--fetch)
5. [Server 3 — Memory](#server-3--memory)
6. [Server 4 — Sequential Thinking](#server-4--sequential-thinking)
7. [Server 5 — Git](#server-5--git)
8. [Server 6 — SQLite](#server-6--sqlite)
9. [Server 7 — Puppeteer](#server-7--puppeteer)
10. [Server 8 — Time](#server-8--time)
11. [All-in-One Config Snippet](#all-in-one-config-snippet)
12. [Managing Servers](#managing-servers)
13. [Tips & Best Practices](#tips--best-practices)

---

## Prerequisites

Before adding any MCP server, make sure the following runtimes are installed on your machine.

### Node.js (required for 7 of the 8 servers)

All `npx`-based servers need Node.js v18 or later.

```bash
# Check if already installed
node --version

# If not installed, download from https://nodejs.org
# Or via a version manager:
nvm install --lts
```

### uv / uvx (required for the Git server only)

The Git MCP server is Python-based and runs via `uvx`.

```bash
# Install uv (includes uvx)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify installation
uvx --version
```

### OpenCode itself

```bash
# Install via curl
curl -fsSL https://opencode.ai/install | bash

# Or via npm
npm install -g opencode-ai

# Or via Homebrew (macOS)
brew install sst/tap/opencode

# Verify
opencode --version
```

---

## How OpenCode MCP Config Works

OpenCode reads MCP server definitions from a JSON config file. There are two locations:

| Location | Scope | Use for |
|---|---|---|
| `~/.config/opencode/opencode.json` | Global (all projects) | Servers you always want available |
| `opencode.json` in project root | Per-project | Servers specific to one codebase |

Project config takes precedence over global config. Both use the exact same schema.

### Config structure

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "your-server-name": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@package/name", "optional-args"]
    }
  }
}
```

### Adding a server via CLI (interactive)

```bash
opencode mcp add
```

This opens an interactive prompt that walks you through adding either a local or remote server.

### Listing configured servers

```bash
opencode mcp list
# Short version
opencode mcp ls
```

### Temporarily disabling a server

Set `"enabled": false` in its config entry — the definition stays, but it won't load:

```json
"filesystem": {
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/your/path"],
  "enabled": false
}
```

---

## Server 1 — Filesystem

**Category:** Filesystem
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Gives the LLM sandboxed read/write access to your local files and directories. It can create, edit, move, rename, and search files — but only within the paths you explicitly allow. This is the single most essential MCP server and should be the first one you install.

### Available tools

| Tool | Description |
|---|---|
| `read_file` | Read a file's contents |
| `write_file` | Write or overwrite a file |
| `create_directory` | Create a new directory |
| `move_file` | Move or rename a file |
| `search_files` | Search file contents with a pattern |
| `list_directory` | List files in a directory |
| `get_file_info` | Get file metadata (size, modified date) |
| `delete_file` | Delete a file |

### Installation

**Step 1.** Open your OpenCode global config:

```bash
# Create config directory if it doesn't exist
mkdir -p ~/.config/opencode

# Open in your editor (replace 'code' with your preferred editor)
code ~/.config/opencode/opencode.json
```

**Step 2.** Add the following to the `mcp` block (replace the path with your actual project directory):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/your/project/path"
      ]
    }
  }
}
```

**Step 3.** To allow multiple directories, add multiple paths as extra args:

```json
"args": [
  "-y",
  "@modelcontextprotocol/server-filesystem",
  "/home/you/projects",
  "/home/you/documents"
]
```

**Step 4.** Restart OpenCode and verify:

```bash
opencode mcp ls
```

> **Security note:** Only add paths you actually need. The server enforces the sandbox strictly — the LLM cannot access any path you haven't listed.

---

## Server 2 — Fetch

**Category:** Web
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Fetches any URL and converts the HTML to clean Markdown that the LLM can read directly. It strips navigation, ads, and boilerplate, returning only meaningful content. Essential for documentation lookups, API references, and web research without leaving your coding session.

### Available tools

| Tool | Description |
|---|---|
| `fetch` | Fetch a URL and return clean Markdown |
| `fetch_html` | Fetch and return raw HTML |
| `fetch_text` | Fetch and return plain text |

### Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "fetch": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

### Usage example

In your OpenCode prompt:

```
Fetch https://docs.python.org/3/library/asyncio.html and summarize the key asyncio patterns
```

---

## Server 3 — Memory

**Category:** AI / Memory
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Maintains a persistent knowledge graph stored as a local file on your machine. Across sessions, it remembers facts you tell it: your tech stack, project conventions, team preferences, recurring decisions. You no longer need to re-explain your context at the start of every conversation.

The knowledge graph survives OpenCode restarts and is stored at `~/.local/share/opencode/memory.json` (or equivalent on your OS).

### Available tools

| Tool | Description |
|---|---|
| `create_entities` | Store new facts or entities |
| `add_relation` | Link two entities together |
| `search_nodes` | Search the knowledge graph |
| `read_graph` | Read the entire graph |
| `delete_entities` | Remove stored facts |
| `add_observations` | Add observations to existing entities |

### Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "memory": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

### Usage example

Tell it facts once:

```
Remember: this project uses PostgreSQL 16, TypeScript 5.4, and the main API runs on port 3001
```

Then in future sessions:

```
What database and port does this project use?
```

---

## Server 4 — Sequential Thinking

**Category:** AI / Reasoning
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Provides the LLM with a structured scratchpad for breaking down complex problems step by step before committing to an answer. It dramatically improves quality on multi-step coding tasks, large refactors, architecture design, and any problem where the LLM tends to rush to an answer without proper analysis.

This server runs invisibly in the background — there is no explicit tool you call. The LLM automatically uses it when it determines structured thinking will help.

### Available tools

| Tool | Description |
|---|---|
| `sequentialthinking` | Structured multi-step reasoning process |

### Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sequential-thinking": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    }
  }
}
```

> **Tip:** This server is particularly valuable for prompts like "refactor this entire module" or "design the database schema for X" — tasks that benefit from a planning phase before execution.

---

## Server 5 — Git

**Category:** Version Control
**Cost:** Free — no API key, no account
**Runtime:** Python (uvx) — requires uv installed

### What it does

Provides full Git operations on local repositories. The LLM can explore commit history, inspect diffs, check blame, list branches, and even stage and commit changes. When combined with the Filesystem server, it gives the LLM complete codebase + history context.

### Available tools

| Tool | Description |
|---|---|
| `git_log` | View commit history |
| `git_diff` | Show diffs between commits or branches |
| `git_blame` | Show blame for a file |
| `git_show` | Show a specific commit |
| `git_branch` | List or create branches |
| `git_commit` | Stage and commit changes |
| `git_status` | Show working directory status |
| `git_add` | Stage files |

### Installation

**Step 1.** Make sure `uvx` is installed (see [Prerequisites](#prerequisites)).

**Step 2.** Add to your `opencode.json` (replace the repository path):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "git": {
      "type": "local",
      "command": "uvx",
      "args": [
        "mcp-server-git",
        "--repository",
        "/your/repo/path"
      ]
    }
  }
}
```

**Step 3.** To use with multiple repositories, add multiple Git entries with different names:

```json
"git-backend": {
  "type": "local",
  "command": "uvx",
  "args": ["mcp-server-git", "--repository", "/path/to/backend"]
},
"git-frontend": {
  "type": "local",
  "command": "uvx",
  "args": ["mcp-server-git", "--repository", "/path/to/frontend"]
}
```

### Usage example

```
Show me the last 10 commits and summarize what changed
```

```
Find which commit introduced the bug in auth.ts
```

---

## Server 6 — SQLite

**Category:** Database
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Full CRUD access to any local SQLite database file. The LLM can explore the schema, run queries, insert records, update data, and analyze results — all without spinning up a separate database process. Perfect for local data analysis, prototyping, and inspecting app databases.

### Available tools

| Tool | Description |
|---|---|
| `query` | Run a raw SQL query |
| `list_tables` | List all tables in the database |
| `get_table_schema` | Describe a table's columns and types |
| `create_record` | Insert a new row |
| `update_record` | Update existing rows |
| `delete_record` | Delete rows |
| `get_db_info` | Get database metadata |

### Installation

Add to your `opencode.json` (replace the path with your `.db` file):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sqlite": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "mcp-sqlite",
        "/path/to/your/database.db"
      ]
    }
  }
}
```

> **Note:** If you don't have a database yet, point the path at a new `.db` file — SQLite will create it automatically on first write.

### Usage example

```
List all tables and show the schema for the users table
```

```
Find all orders placed in the last 30 days and calculate total revenue
```

---

## Server 7 — Puppeteer

**Category:** Browser Automation
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx) — downloads Chromium (~300MB) on first run

### What it does

Full headless browser automation via Puppeteer. The LLM can navigate to URLs, click elements, fill forms, take screenshots, and execute JavaScript in the browser context. Ideal for UI testing, end-to-end automation, web scraping, and visual verification of web apps.

### Available tools

| Tool | Description |
|---|---|
| `puppeteer_navigate` | Navigate to a URL |
| `puppeteer_screenshot` | Take a screenshot |
| `puppeteer_click` | Click an element by selector |
| `puppeteer_fill` | Fill a form field |
| `puppeteer_evaluate` | Run JavaScript in the page |
| `puppeteer_select` | Select a dropdown option |
| `puppeteer_hover` | Hover over an element |

### Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "puppeteer": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

> **First run:** Puppeteer will automatically download a compatible Chromium binary (~300MB). This only happens once. Subsequent starts are instant.

### Optional: Run with visible browser window

Add environment variables to see the browser in action:

```json
"puppeteer": {
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
  "env": {
    "PUPPETEER_LAUNCH_OPTIONS": "{\"headless\": false}",
    "ALLOW_DANGEROUS": "true"
  }
}
```

### Usage example

```
Navigate to http://localhost:3000, take a screenshot, and tell me what you see
```

```
Go to the login page, fill in test@example.com and password123, then click Submit
```

---

## Server 8 — Time

**Category:** Utilities
**Cost:** Free — no API key, no account
**Runtime:** Node.js (npx)

### What it does

Provides accurate current time, date, and timezone conversion. Useful for scripts that deal with timestamps, scheduling logic, date arithmetic, and any workflow involving time zones.

### Available tools

| Tool | Description |
|---|---|
| `get_current_time` | Get the current time in any timezone |
| `convert_time` | Convert a time between two timezones |

### Installation

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "time": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-time"]
    }
  }
}
```

### Usage example

```
What time is it right now in Tokyo, New York, and London?
```

```
Convert 3:30 PM EST to CET
```

---

## All-in-One Config Snippet

Copy this entire block into `~/.config/opencode/opencode.json` to install all 8 servers at once. Replace the paths marked with comments.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {

    "filesystem": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/your/project/path"
      ]
    },

    "fetch": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },

    "memory": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },

    "sequential-thinking": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },

    "git": {
      "type": "local",
      "command": "uvx",
      "args": [
        "mcp-server-git",
        "--repository",
        "/your/repo/path"
      ]
    },

    "sqlite": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "mcp-sqlite",
        "/path/to/your/database.db"
      ]
    },

    "puppeteer": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },

    "time": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-time"]
    }

  }
}
```

---

## Managing Servers

### List all servers and their status

```bash
opencode mcp ls
```

### Debug a server (test connection and auth)

```bash
opencode mcp debug <server-name>
```

### Remove a server from config

Delete its entry from `opencode.json`, or use:

```bash
opencode mcp remove <server-name>
```

### Disable a server without removing it

Set `"enabled": false` in the server's config block. To re-enable later, set it back to `true` or remove the `enabled` field entirely.

### Enable a server only for a specific agent

First disable it globally, then re-enable it in your agent config:

```json
"tools": {
  "mcp_puppeteer_puppeteer_navigate": {
    "enabled": true
  }
}
```

---

## Tips & Best Practices

### Start minimal

A good starter stack that covers most coding workflows with minimal context overhead:

- **Filesystem** — file access
- **Fetch** — documentation and web lookup
- **Memory** — persistent context
- **Sequential Thinking** — better reasoning

Add Git, SQLite, and Puppeteer only when you need them for a specific project.

### Context window budget

Each MCP server adds to the LLM's context window. More tools = more tokens consumed per request. Disable servers you're not actively using rather than leaving everything enabled at once.

### Use per-project configs

For project-specific servers (like Git pointing at a specific repo, or SQLite pointing at an app database), add them in an `opencode.json` at the project root instead of the global config. This keeps your global config clean.

### Reference servers by name in prompts

You can address a specific MCP server by its config name to guide the LLM:

```
Use the sqlite tool to find all users created this month
```

```
Use memory to remember that this project uses React 19 with Server Components
```

### Windows users

For `npx`-based servers on Windows, wrap the command as follows:

```json
"filesystem": {
  "type": "local",
  "command": "cmd",
  "args": [
    "/c", "npx", "-y",
    "@modelcontextprotocol/server-filesystem",
    "C:\\Users\\you\\projects"
  ]
}
```

---

*All servers listed are open-source under the MIT License. No telemetry, no cloud calls, no paid tiers required.*

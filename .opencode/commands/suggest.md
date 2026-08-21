---
name: suggest
description: >-
  Load all project context, synthesize architecture overview, and suggest high-impact features.
  Reads graphify knowledge graph, boot files, and key source files to produce a comprehensive
  project overview with actionable feature suggestions. Aligns suggestions with AHG Unlocker's
  core purpose (Steam game/DLC unlocking via manifest injection).
arguments: '[optional focus area, e.g., "performance", "ui", "features", "architecture"]'
---

Invoke the `suggest` skill to load full project context and generate an overview with high-impact feature suggestions.

Usage:
```
/suggest                   — Full project overview + feature suggestions
/suggest performance       — Focus on performance-related suggestions
/suggest ui                — Focus on UI/UX suggestions
/suggest features          — Focus on new feature suggestions
/suggest architecture      — Focus on architecture improvements
```

---
name: ahgremovelicense
description: >-
  Remove AHG Unlocker license files (ahg_license.json and ahg_machine_id.json)
  from the app's userData directory at %APPDATA%\AHG Unlocker\. This is a
  fast utility command — the user types /ahgremovelicense and expects the
  license files to be deleted immediately with no further prompts or
  questions. Always run this immediately when the user invokes it.
  Do NOT ask for confirmation, do NOT explain what you're doing — just
  find and delete the files, then confirm in one line.
---

# Skill: ahgremovelicense

AHG Unlocker license removal utility. Instant delete of local license files.

## Behavior

The user types `/ahgremovelicense` → you delete the files → you confirm.

### Steps

1. Determine the userData path. On Windows this is typically:
   ```
   %APPDATA%\AHG Unlocker\
   ```
   Resolve it: `$env:APPDATA\AHG Unlocker`

2. Delete these files (if they exist):
   - `ahg_license.json`
   - `ahg_machine_id.json`

3. Confirm in **one short line**:
   - If both deleted: `✅ License files removed.`
   - If none existed: `✅ No license files found.`
   - If partial: `✅ Removed ahg_license.json (ahg_machine_id.json not found).`

### Constraints

- **NO confirmation prompts.** The user typed the command — execute immediately.
- **NO verbose output.** One line response maximum.
- **Do NOT touch any other files.** Only the two license files above.
- **Do NOT check or verify anything beyond deletion success.**

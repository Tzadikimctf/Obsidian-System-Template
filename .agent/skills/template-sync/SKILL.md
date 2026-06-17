---
name: template-sync
description: Sync system templates, custom agent skills, plugins, themes, and configuration files from the active vault to the template repository (Obsidian-System-Template). Use this when changes have been made to templates, skills, or settings in the active vault that need to be committed to the template vault, or when checking differences between the two.
---

# Template Sync Skill

This skill synchronizes system settings, plugins, templates, and agent skills from the active working vault to the standalone template repository (`Obsidian-System-Template`). It ensures that your customization logic, layout templates, and plugins are version-controlled and reusable, while safely ignoring your personal/academic notes.

## Sync Scope

The sync tool only targets a whitelisted subset of directories and files:
*   `090 System/000 Templates/` (notes and MOC scripts)
*   `.agent/skills/` (custom AI skills)
*   `.obsidian/plugins/` (installed community plugins)
*   `.obsidian/snippets/` & `.obsidian/themes/` (visual configurations)
*   `.obsidian/*.json` (global hotkeys, core plugins, and settings)
*   `000 Home MOC.md`, `090 Atlas.md`, `AI.md`, `.cursorrules` (root system files)

All personal and academic directories (e.g., `010 Projects`, `021 University`, daily notes, and standard `.git` histories) are completely ignored to prevent data leaks.

## How to Use

### 1. Dry Run (Preview Changes)
Run the script without any flags to preview which files will be copied, updated, or deleted, without modifying anything:

```powershell
python .agent/skills/template-sync/scripts/sync.py
```

### 2. Apply Sync (Copy Files)
To copy new and modified files from the active vault to the template repository, run with the `--force` flag:

```powershell
python .agent/skills/template-sync/scripts/sync.py --force
```

### 3. Prune Deleted Files
If you have deleted templates or skills in the active vault and want to remove them from the template repository to match, run with both `--force` and `--prune`:

```powershell
python .agent/skills/template-sync/scripts/sync.py --force --prune
```

### 4. Custom Destination Vault Path
If the template vault is checked out in a different location, specify it using the `--dest` parameter:

```powershell
python .agent/skills/template-sync/scripts/sync.py --dest "C:/custom/path/to/Obsidian-System-Template"
```

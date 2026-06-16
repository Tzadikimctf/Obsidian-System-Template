# 🧠 AI Guide & Vault System Rules

This file is a system reference and instruction guide for any AI assistants, Copilot plugins, or agents (e.g., Cursor, Cliner, Gemini, Copilot) interacting with this Obsidian Vault. It ensures all AI-generated content conforms to the vault's structure, metadata design, and automation workflows.

---

## 📂 Vault Folder Directory Structure

The vault is organized into numbered folders representing specific life/study areas:

```
Vault Root/
│
├── 000 Home MOC.md                    # Main Command Center Dashboard
│
├── 001 Daily Notes/                   # Daily journaling & logging
│
├── 010 Projects/                      # Projects hub
│   ├── 000 Projects MOC.md            # Projects Dashboard (uses database views)
│   ├── Projects Dashboard.base        # Database configuration file
│   └── Todo/ / Active/ / Test/        # Categorized project folders
│       └── <Project Name>/            # Specific project folder
│           ├── <Project Name> MOC.md  # Project Home & Mission Statement
│           ├── Logs/                  # Project entry logs (created by Smart Note Creator)
│           ├── attachments/           # Local assets & files
│           ├── code/                  # Related code clips or scripts
│           └── archive/               # Archived materials
│
├── 011 Resource Inbox/                # Inbox for clipped articles and web pages
│
├── 012 Idea Inbox/                    # Inbox for capturing quick, unprocessed ideas
│
├── 020 Courses/                       # Non-academic courses (YouTube, Udemy, etc.)
│   ├── 000 Courses MOC.md             # Master Courses Dashboard
│   ├── Courses Dashboard.base         # Database configuration file
│   └── <Course Name>/                 # Specific course folder
│       ├── <Course Name> MOC.md       # Course Home & Details
│       ├── Lectures/                  # Course lectures/logs
│       ├── Assignments/               # Course assignments
│       └── Resources/                 # Course-specific resources/files
│
├── 021 University/                    # Academic university courses
│   ├── 000 University MOC.md          # Master Academic Dashboard
│   ├── University Dashboard.base      # Database configuration file
│   └── <Course Name>/                 # Specific university course folder
│       ├── <Course Name> MOC.md       # University Course Home (exam dates, credits)
│       ├── Lectures/                  # University lecture notes
│       ├── Assignments/               # Problem sets, homework
│       └── Resources/                 # Reference papers, slides, syllabus
│
├── 090 Atlas/                         # Knowledge base / evergreen notes
│
├── 090 System/                        # System configurations, templates & scripts
│   └── 000 Templates/                 # Templater templates and automation scripts
│
└── copilot/                           # AI Copilot plugin data (conversations, custom prompts)
```

---

## 🏷️ Metadata Frontmatter Schemas

Every note in the vault must contain valid YAML frontmatter matching its note type. Never erase or omit these fields when writing or editing notes.

### 1. Master MOC (Command Centers)
* **Path:** `000 Home MOC.md`, `010 Projects/000 Projects MOC.md`, `020 Courses/000 Courses MOC.md`, `021 University/000 University MOC.md`
```yaml
---
type: master_moc
links: "[[000 Home]]"
---
```

### 2. Project MOC (Individual Project Home)
* **Path:** `010 Projects/.../<Project Name>/<Project Name> MOC.md`
```yaml
---
type: project_moc
status: "🔴 Todo"         # Options: "🔴 Todo", "🟢 Active", "💤 On Hold", "✅ Completed"
priority: 5              # Priority scale (1 to 10)
subject: "[[ <Optional Subject MOC> ]]"
tags: ["tag1", "tag2"]
date_started: YYYY-MM-DD
links:
  - "[[010 Projects]]"
  - "[[000 Projects MOC]]"
---
```

### 3. Project Note (Log Entries / Research Notes)
* **Path:** `010 Projects/.../<Project Name>/Logs/<Note Name>.md`
```yaml
---
type: project_note
project: "[[<Project Name>]]"
status: 🟢 Active
priority: 5
order: 1                 # Chronological order sequence number
date_added: YYYY-MM-DD
links:
  - "[[010 Projects]]"
---
```

### 4. University Course MOC
* **Path:** `021 University/<Course Name>/<Course Name> MOC.md`
```yaml
---
type: uni_course_moc
status: "🟡 In Progress"   # Options: "🟡 In Progress", "✅ Completed"
semester: "A"            # "A", "B", or "Summer"
academic_year: "YYYY-YYYY"
credits: 5               # Course credit weight
exam_date: YYYY-MM-DD    # Or empty/TBD
subject: "[[ <Optional Subject MOC> ]]"
date_enrolled: YYYY-MM-DD
---
```

### 5. University Lecture
* **Path:** `021 University/<Course Name>/Lectures/<Lecture Name>.md`
```yaml
---
type: uni_lecture
course: "[[<Course Name>]]"
status: 🟢 Active
order: 1                 # Lecture number sequence
date_added: YYYY-MM-DD
---
```

### 6. Homework / Assignment
* **Path:** `021 University/<Course Name>/Assignments/<Assignment Name>.md`
```yaml
---
type: homework
subject: "[[<Course Name>]]" # Auto-resolved to parent folder
status: 🔴 Todo            # Options: "🔴 Todo", "🟡 In Progress", "✅ Completed"
due: YYYY-MM-DD
tags:
  - Academia
links:
  - "[[<Folder Path>]]"
starting time: YY/MM/DD, HH:MM
teacher: name
progress: WIP
---
```

### 7. Course MOC (General Courses)
* **Path:** `020 Courses/<Course Name>/<Course Name> MOC.md`
```yaml
---
type: course_moc
status: "🟢 Active"       # Options: "🟢 Active", "🔴 Todo", "✅ Completed"
priority: 5              # Priority scale (1 to 10)
platform: "YouTube"      # YouTube, Coursera, Udemy, etc.
subject: "[[ <Optional Subject MOC> ]]"
date_started: YYYY-MM-DD
links:
  - "[[020 Courses]]"
  - "[[000 Courses MOC]]"
---
```

### 8. Course Note (General Course Lectures)
* **Path:** `020 Courses/<Course Name>/Lectures/<Lecture Name>.md`
```yaml
---
type: course_note
course: "[[<Course Name>]]"
status: 🟢 Active
order: 1                 # Lecture sequence number
date_added: YYYY-MM-DD
---
```

---

## 🛠️ Note Creation & Automation Workflows

The vault utilizes **Templater** for automating note creation. AI assistants should prefer instructing users to run Templater scripts rather than creating files manually.

1. **Creating Projects, Uni Courses, or General Courses**:
   - Run the designated script:
     - `New Project Script.md` -> Sets up `010 Projects/Todo/<Name>` and template folders.
     - `New Uni Course Script.md` -> Sets up `021 University/<Name>`, resolves academic year/semester, and creates template folders.
     - `New Course Script.md` -> Sets up `020 Courses/<Name>` and template folders.
2. **Adding notes inside a Course or Project**:
   - Run the `Smart Note Creator.md` script from an open MOC file.
   - The script automatically detects the parent note's `type` frontmatter:
     - `project_moc` -> Creates a `Project Note` in `Logs/`.
     - `uni_course_moc` -> Creates a `Uni Lecture` in `Lectures/`.
     - `course_moc` -> Creates a `Course Note` in `Lectures/`.
   - It prompts for the note name and sequence order, populating the new note with appropriate links and frontmatter.

---

## 🔌 Live App Connection (AI Connector)

This vault includes a live-running connection interface located in [`.agent/skills/obsidian-connector/`](file:///c:/Users/thomy/Obsidian-System-Template/.agent/skills/obsidian-connector/). If you are running as an AI agent (e.g. Cursor, Gemini, Cliner) inside this vault, you can query the active Obsidian instance directly to read state, verify rendering, or run actions using these scripts:

* **Check active note path**: `python ".agent/skills/obsidian-connector/obsidian_rest.py" get-active`
* **Read file content**: `python ".agent/skills/obsidian-connector/obsidian_rest.py" read-note "<vault_path>"`
* **Execute command**: `python ".agent/skills/obsidian-connector/obsidian_rest.py" run-command "<command_id>"`
* **Inspect live visual DOM**: `uv run python ".agent/skills/obsidian-connector/obsidian_cdp.py" eval "<js_expression>"`

Refer to the custom skill definition in [`SKILL.md`](file:///c:/Users/thomy/Obsidian-System-Template/.agent/skills/obsidian-connector/SKILL.md) for full setup instructions (requires the Local REST API plugin and/or starting Obsidian with debug port 9222).

---

## 🤖 AI Guidelines & Best Practices

When generating text, modifying files, or creating new content in this vault, AI must adhere to these guidelines:

* **Use Obsidian Link Formatting:** Always link to other notes or subjects using double brackets: `[[Note Name]]`. Do not use markdown URLs for internal vault links.
* **Preserve Frontmatter:** Never modify frontmatter properties unless explicitly requested (e.g. updating a project's status or setting `exam_date`). Ensure you do not change existing dates or types.
* **Respect Dashboard Views:** Dashboards (e.g. `Projects Dashboard.base`, `University Dashboard.base`, `Courses Dashboard.base`) are powered by database views. Do not edit their files directly unless updating dashboard schema structure.
* **Maintain MOC Connections:** Any new project or course note should maintain double-bracket navigation links at the bottom: `**Previous:** [[Prev Note]] | **Next:** [[Next Note]]`.
* **Use Premium Callout Layouts:** When requested to style or structure an MOC, use multi-column callouts (e.g. `> [!multi-column]`) and standard Obsidian alert blocks (e.g. `> [!info]`, `> [!abstract]`) to keep dashboards visually stunning.

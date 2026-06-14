# 🏛️ Obsidian System Vault Template

This is a clean, automated Obsidian Vault template structured using a PARA / Johnny Decimal hybrid system. It is designed to act as a personal command center, tracking projects, self-directed learning, and academic studies with high automation.

---

## 📂 Vault Structure Overview

* **`000 Home MOC.md`** - Your main command center dashboard.
* **`001 Daily Notes/`** - Daily logs and automated checklist aggregation.
* **`010 Projects/`** - Active and backlog projects with automatic subfolders and base dashboards.
* **`011 Resource Inbox/`** - Raw web clippings and article imports.
* **`012 Idea Inbox/`** - Instantly captured raw thoughts.
* **`020 Courses/`** - Extra-curricular/self-directed learning (Udemy, YouTube, etc.).
* **`021 University/`** - Academic courses with grading, exam countdowns, and lecture notes.
* **`090 Atlas/`** - Evergrowing knowledge base where notes are synthesized.
* **`090 System/`** - Internal system templates, automation scripts, and layouts.

---

## 🔌 Required Community Plugins

All plugin configurations are pre-bundled in the template's `.obsidian/` folder. Ensure you enable the following plugins in Obsidian's settings:
1. **Templater:** Powers the course, project, and assignment generation scripts.
2. **Meta Bind:** Renders active button interfaces on the dashboards.
3. **Dataview:** Queries and displays dynamic tables for your projects and academic records.
4. **Obsidian Tasks:** Unifies and aggregates all checklist tasks vault-wide.
5. **LaTeX Suite:** Enables lightning-fast math typesetting during STEM lectures.

---

## ⚡ Core Automation Workflows

All note generation workflows are automated. Avoid creating project, course, or lecture notes manually; instead, use the buttons in **`000 Home MOC.md`** or the templates inside **`090 System/000 Templates/`**:

### 1. Project Creation (`New Project Script.md`)
* Prompt for Project Name and Tags.
* Automatically initializes the folder structure: `010 Projects/Todo/<Project Name>/` with subfolders `attachments/`, `code/`, and `archive/`.
* Creates a `<Project Name> MOC.md` pointing to the projects dashboard.

### 2. University Course Enrollment (`New Uni Course Script.md`)
* Prompts for Course Name.
* Automatically detects the active Semester (A, B, or Summer) and Academic Year based on the current date.
* Initializes the folder structure: `021 University/<Course Name>/` with `Lectures/`, `Assignments/`, and `Resources/`.
* Creates a course MOC using the academic tracking frontmatter.

### 3. Chronological Smart Note Creator (`Smart Note Creator.md`)
* Execute this script from inside any Project MOC or Course MOC.
* It automatically detects the type of MOC (e.g. `uni_course_moc` or `project_moc`), identifies the destination folder (`Lectures/` or `Logs/`), counts the existing notes *matching that specific frontmatter type*, and suggests the next sequential order number (e.g., if you have 10 lectures, it defaults the prompt to `11`).

---

## 🏫 University System Details

### 📊 Performance Tracking (GPA Card)
The home page of your university portal ([000 University MOC.md](file:///c:/Users/thomy/Obsidian-System-Template/021%20University/000%20University%20MOC.md)) contains an automated DataviewJS card summarizing your academic standings:
* **Weighted GPA:** Automatically calculates grade weights based on credits:
  $$\text{Weighted GPA} = \frac{\sum (\text{Grade} \times \text{Credits})}{\sum \text{Credits}}$$
* **Unweighted GPA:** Calculates the simple average of all graded courses.
* **Completed Credits:** Sums up the credits of all courses with the status `"✅ Completed"`.
* To update your grades, simply set `status: "✅ Completed"` and input a number in `grade: ` inside any course MOC.

### 📅 Moed A & Moed B Deadlines
To accommodate university exam schedules, the vault splits exam dates into two fields in the course MOC frontmatter:
```yaml
exam_date_a: YYYY-MM-DD
exam_date_b: YYYY-MM-DD
```
The **`🎓 THIS SEMESTER`** view calculates and displays countdowns for both exams (e.g., `14 days left`) and sorts active courses by the closest Moed A exam date.

### 📅 Dynamic Task Board
No need to maintain manual checkboards. The `Academic Tasks` section on the university portal automatically scans all notes in `021 University/` for incomplete markdown checklist tasks (`- [ ]`) and groups them by course directory.

---

## 📐 LaTeX Suite Typesetting Snippets

For STEM courses, a comprehensive set of real-time math snippets is loaded from [latex-suite-snippets.js](file:///c:/Users/thomy/Obsidian-System-Template/090%20System/Latex/latex-suite-snippets.js). 

### Popular Math Mode Shortcuts:
* **`mk`** ➡️ `$$0$` (inline math mode)
* **`dm`** ➡️ `$$\n$0\n$$` (display/centered math mode)
* **`beg`** ➡️ Opens a `\begin{env} ... \end{env}` block.
* **`//`** ➡️ `\frac{numerator}{denominator}` (fraction typesetting)
* **`sr` / `cb`** ➡️ `^2` / `^3` (fast squaring/cubing)
* **`pmat` / `bmat`** ➡️ Renders standard matrix types `pmatrix` and `bmatrix`.
* **`@a` / `@b` / `@g` / `@o`** ➡️ `\alpha`, `\beta`, `\gamma`, `\omega` (Greek characters)
* **`=>` / `->`** ➡️ `\implies` / `\to` (arrows)
* **`sum` / `lim` / `int`** ➡️ Auto-expands limits, integrations, and summations with lower/upper bound placeholders.
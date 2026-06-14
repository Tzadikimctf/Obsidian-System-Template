---
type: sovereign_moc
links: "[[000 Home]]"
cssclasses:
  - home-moc
---
# 🏛️ Command Center



### ⚡ Quick Capture

```meta-bind-button
style: primary
label: "🧠 Instant Idea"
class: btn-idea
action:
  type: runTemplaterFile
  templateFile: "090 System/000 Templates/Instant Note Script.md"
```

```meta-bind-button
style: primary
label: "📓 Daily Note"
class: btn-daily
action:
  type: command
  command: daily-notes
```

```meta-bind-button
style: primary
label: "📝 New Assignment"
class: btn-homework
action:
  type: runTemplaterFile
  templateFile: "090 System/000 Templates/New Homework Script.md"
```

### 🗺️ Navigation
- [[000 Projects MOC|🚀 Projects]]
- [[000 University MOC|🏫 University]]
- [[000 Courses MOC|🎓 Courses]]
- [[090 Atlas|🗺️ Knowledge]]

---

## 📅 High-Priority Focus
*Combined view of your active technical projects and upcoming university exams.*

### 🚀 Active Projects
![[Projects Dashboard.base#🔥 ACTIVE]]

### 🎓 University Deadlines
![[University Dashboard.base#🎓 THIS SEMESTER]]

### 📅 Today's Tasks
```tasks
not done
due before tomorrow
```

### 📝 Upcoming Assignments
```dataview
TABLE due AS "Due Date", progress AS "Progress"
FROM "021 University"
WHERE type = "homework" AND status != "✅ Completed"
SORT due ASC
LIMIT 5
```

---

## 📥 The Processing Queue
> [!multi-column]
>
> > #### 🧠 Fresh Ideas (012)
> > ```dataview
> > LIST FROM "012 Idea Inbox" WHERE status = "🧠 Raw" LIMIT 5
> > ```
>
> > #### 📥 Raw Resources (011)
> > ```dataview
> > LIST FROM "011 Resource Inbox" OR "Clippings" WHERE status = "📥 Unprocessed" OR (file.folder = "Clippings" AND !status) LIMIT 5
> > ```



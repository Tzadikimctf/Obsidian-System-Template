<%*
const idea = await tp.system.prompt("What's the idea?");
if (!idea) return;

// Clean title: first 20 chars of the idea
const cleanTitle = idea.substring(0, 20).replace(/[\\/:*?"<>|]/g, "");
const fileName = `Idea - ${cleanTitle} ${tp.date.now("HHmm")}`;

const openTag = "<" + "%";
const closeTag = "%" + ">";

const content = `---
type: idea_capture
status: "🧠 Raw"
date_captured: ${tp.date.now("YYYY-MM-DD HH:mm")}
tags: ["idea"]
---
# ${idea}

---
## 💭 Initial Thoughts
${openTag} tp.file.cursor() ${closeTag}

---
## 🚀 Potential Path
- [ ] Convert to Project?
- [ ] Convert to Permanent Note?
`;

const path = `012 Idea Inbox/${fileName}.md`;
await app.vault.create(path, content);

const newFile = app.vault.getAbstractFileByPath(path);
await app.workspace.getLeaf().openFile(newFile);

new Notice(`Idea captured and opened from 012 Idea Inbox.`);
%>
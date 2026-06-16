<%*
const idea = await tp.system.prompt("What's the idea?");
if (!idea) return;

// Clean title: first 50 chars of the idea, avoiding cut-off words
let cleanTitle = idea.substring(0, 50).replace(/[\\/:*?"<>|]/g, "");
if (idea.length > 50) {
    const lastSpace = cleanTitle.lastIndexOf(" ");
    if (lastSpace > 0) {
        cleanTitle = cleanTitle.substring(0, lastSpace);
    }
}
cleanTitle = cleanTitle.trim();

const fileName = `Idea - ${cleanTitle} ${tp.date.now("HHmm")}`;

const content = `---
type: idea_capture
status: "🧠 Raw"
date_captured: ${tp.date.now("YYYY-MM-DD HH:mm")}
tags: ["idea"]
---
# ${idea}

---
## 💭 Initial Thoughts


---
## 🚀 Potential Path
- [ ] Convert to Project?
- [ ] Convert to Permanent Note?
`;

const folder = app.vault.getAbstractFileByPath("012 Idea Inbox");
await tp.file.create_new(content, fileName, true, folder);

// Set the cursor programmatically in the new note
setTimeout(() => {
    const activeView = app.workspace.getActiveViewOfType(tp.obsidian.MarkdownView);
    const editor = activeView?.editor;
    if (editor) {
        const lines = editor.getValue().split("\n");
        const targetLineIndex = lines.findIndex(line => line.includes("## 💭 Initial Thoughts"));
        if (targetLineIndex !== -1) {
            editor.setCursor({ line: targetLineIndex + 1, ch: 0 });
            editor.focus();
        }
    }
}, 100);

new Notice(`Idea captured and opened from 012 Idea Inbox.`);
%>
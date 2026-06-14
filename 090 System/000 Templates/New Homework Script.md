<%*
// 1. Get list of University courses (subfolders in 021 University)
const uniFolder = app.vault.getAbstractFileByPath("021 University");
if (!uniFolder || !uniFolder.children) {
    new Notice("Error: 021 University folder not found.");
    return;
}
const courses = uniFolder.children
    .filter(c => c.children) // is a folder
    .map(c => c.name)
    .filter(name => name !== "Resources"); // exclude general Resources folder

if (courses.length === 0) {
    new Notice("No university courses found to assign homework to.");
    return;
}

// 2. Prompt for Course selection
const courseName = await tp.system.suggester(courses, courses);
if (!courseName) return;

// 3. Prompt for Homework Name
const hwName = await tp.system.prompt("Assignment Name (e.g. Homework 1)");
if (!hwName) return;

// 4. Prompt for Due Date
const dueDate = await tp.system.prompt("Due Date (YYYY-MM-DD)", tp.date.now("YYYY-MM-DD", 7));
if (!dueDate) return;

// Resolve subject name and paths
const startingTime = tp.date.now("YY/MM/DD, HH:mm");
const openTag = "<" + "%";
const closeTag = "%" + ">";

// Construct the file contents
const content = `---
type: homework
subject: "[[${courseName}]]"
status: 🔴 Todo
due: ${dueDate}
tags:
  - Academia
links:
  - "[[021 University/${courseName}/Assignments]]"
starting time: ${startingTime}
teacher: name
progress: WIP
---
# ${hwName}

## 📝 Details & Instructions
- 

---
## ✍️ Work Area
${openTag} tp.file.cursor() ${closeTag}
`;

// Create target folder if missing
const targetFolder = `021 University/${courseName}/Assignments`;
if (!app.vault.getAbstractFileByPath(targetFolder)) {
    await app.vault.createFolder(targetFolder);
}

// Create and Open file
const finalPath = `${targetFolder}/${hwName}.md`;
await app.vault.create(finalPath, content);

const newFile = app.vault.getAbstractFileByPath(finalPath);
await app.workspace.getLeaf().openFile(newFile);

new Notice(`Assignment ${hwName} created.`);
%>

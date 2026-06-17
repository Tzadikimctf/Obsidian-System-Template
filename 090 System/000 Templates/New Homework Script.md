<%*
// Configuration: Feel free to customize these naming defaults
const ASSIGNMENT_PREFIX = "Homework";          // Prefix (e.g. "Homework", "Assignment")
const DEFAULT_SUBFOLDER = "Homework";            // Fallback folder under course if none exists

const activeFile = tp.config.active_file;
let courseName = "";
let studentName = "";

if (activeFile) {
    const fileCache = app.metadataCache.getFileCache(activeFile);
    const mocType = fileCache?.frontmatter?.type;
    
    // Auto-resolve course name from current MOC if applicable
    if (mocType === "uni_course_moc" || mocType === "course_moc") {
        courseName = activeFile.parent.name;
        studentName = fileCache?.frontmatter?.student_name;
    }
}

// Fallback to global setting in Home MOC if not found in current course MOC
if (!studentName) {
    const homeFile = app.vault.getAbstractFileByPath("000 Home MOC.md");
    if (homeFile) {
        const homeCache = app.metadataCache.getFileCache(homeFile);
        studentName = homeCache?.frontmatter?.student_name;
    }
}

// Fallback to default name if still not found
if (!studentName) {
    studentName = "Thomas Goldman";
}

const STUDENT_NAME_SUFFIX = studentName ? `-${studentName}` : "";

if (!courseName) {
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
    courseName = await tp.system.suggester(courses, courses);
    if (!courseName) return;
}

// 3. Resolve target folder name (check existing "Assignments" or "Homework" folder)
let subFolder = DEFAULT_SUBFOLDER;
if (app.vault.getAbstractFileByPath(`021 University/${courseName}/Assignments`)) {
    subFolder = "Assignments";
} else if (app.vault.getAbstractFileByPath(`021 University/${courseName}/Homework`)) {
    subFolder = "Homework";
}
const targetFolder = `021 University/${courseName}/${subFolder}`;

// 4. Calculate next homework sequence number based on existing files in that folder
let nextHwNumber = "1";
const folderObj = app.vault.getAbstractFileByPath(targetFolder);
if (folderObj && folderObj.children) {
    const hwFiles = folderObj.children.filter(f => f.extension === "md" || f.name.endsWith(".md"));
    nextHwNumber = (hwFiles.length + 1).toString();
}

// 5. Prompt for Homework Number
const hwNumber = await tp.system.prompt("Homework Number", nextHwNumber);
if (!hwNumber) return;

// 6. Generate and prompt to verify file name
const defaultName = `${ASSIGNMENT_PREFIX} ${hwNumber} ${courseName}${STUDENT_NAME_SUFFIX}`;
const hwName = await tp.system.prompt("Confirm File Name", defaultName);
if (!hwName) return;

// 7. Prompt for Due Date
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
  - "[[021 University/${courseName}/${subFolder}]]"
starting time: ${startingTime}
teacher: name
progress: WIP
---
# ${hwName}

**MOC:** [[${courseName} MOC]]

## 📝 Details & Instructions
- 

---
## ✍️ Work Area
${openTag} tp.file.cursor() ${closeTag}
`;

// Create target folder if missing
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

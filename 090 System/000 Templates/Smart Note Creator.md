<%*
const activeFile = tp.config.active_file;
if (!activeFile) {
    new Notice("Error: No active file found.");
    return;
}
const parentMOC = activeFile.basename;
const parentFolder = activeFile.parent.path;

const fileCache = app.metadataCache.getFileCache(activeFile);
const mocType = fileCache?.frontmatter?.type;

let templatePath = "";
let subFolder = "";
let targetType = "";
let isGeneralNote = false;

// Detection Logic
if (mocType === "project_moc") {
    templatePath = "090 System/000 Templates/Project Note Template.md";
    subFolder = "Logs"; 
    targetType = "project_note";
} else if (mocType === "uni_course_moc") {
    const choice = await tp.system.suggester(["📓 Lecture Note", "📝 General Note / Summary"], ["Lecture Note", "General Note"]);
    if (!choice) return;
    
    if (choice === "Lecture Note") {
        templatePath = "090 System/000 Templates/Uni Lecture Template.md";
        subFolder = "Lectures";
        targetType = "uni_lecture";
    } else {
        templatePath = "090 System/000 Templates/Uni Lecture Template.md";
        subFolder = "";
        targetType = "uni_general";
        isGeneralNote = true;
    }
} else if (mocType === "course_moc") {
    const choice = await tp.system.suggester(["📓 Lecture / Section Note", "📝 General Note / Summary"], ["Lecture Note", "General Note"]);
    if (!choice) return;
    
    if (choice === "Lecture Note") {
        templatePath = "090 System/000 Templates/Course Note Template.md";
        subFolder = "Lectures";
        targetType = "course_note";
    } else {
        templatePath = "090 System/000 Templates/Course Note Template.md";
        subFolder = "";
        targetType = "course_note";
        isGeneralNote = true;
    }
} else {
    new Notice("Error: Active note is not a valid Course or Project MOC.");
    return;
}

const noteName = await tp.system.prompt("Note Name");
if (!noteName) return;

// Calculate next order sequence number
let orderDefault = "1";
if (isGeneralNote) {
    orderDefault = "Summary";
} else {
    const targetFolderObj = app.vault.getAbstractFileByPath(`${parentFolder}/${subFolder}`);
    if (targetFolderObj && targetFolderObj.children) {
        const mdFiles = targetFolderObj.children.filter(f => {
            if (f.extension !== "md" && !f.name.endsWith(".md")) return false;
            const cache = app.metadataCache.getFileCache(f);
            return cache?.frontmatter?.type === targetType;
        });
        orderDefault = (mdFiles.length + 1).toString();
    }
}

const order = await tp.system.prompt("Order/Sequence", orderDefault);
if (!order) return;

const templateFile = app.vault.getAbstractFileByPath(templatePath);
if (!templateFile) {
    new Notice("Error: Template file not found at " + templatePath);
    return;
}
let content = await app.vault.read(templateFile);

// Replacements
content = content.replace(/{{title}}/g, noteName);
content = content.replace(/{{parent}}/g, parentMOC);
content = content.replace(/{{order}}/g, order);
content = content.replace(/{{date}}/g, tp.date.now("YYYY-MM-DD"));

if (isGeneralNote) {
    // Normalize line endings to LF to make string replacements reliable
    content = content.replace(/\r\n/g, "\n");

    // Change frontmatter type to uni_general if it was uni_lecture
    content = content.replace("type: uni_lecture", "type: uni_general");
    
    // Remove sequence/lecture lines for general notes
    content = content.replace("**Lecture:** #Summary\n", "");
    content = content.replace("**Sequence:** #Summary\n", "");
    
    // Remove the lecture notes/learning log sections entirely for general notes
    // We split the tag delimiters to prevent Templater from parsing them during template compilation
    content = content.replace("---\n\n## ✍️ Lecture Notes\n<" + "% tp.file.cursor(2) %" + ">\n\n", "");
    content = content.replace("---\n\n## 📝 Learning Log\n<" + "% tp.file.cursor(2) %" + ">\n\n", "");
}

// Create subfolder if missing
const targetPath = subFolder ? `${parentFolder}/${subFolder}` : parentFolder;
if (subFolder && !app.vault.getAbstractFileByPath(targetPath)) {
    await app.vault.createFolder(targetPath);
}

// Create and Open
const finalPath = `${targetPath}/${noteName}.md`;
await app.vault.create(finalPath, content);
const newFile = app.vault.getAbstractFileByPath(finalPath);
await app.workspace.getLeaf().openFile(newFile);

// Force Templater to run on the newly opened file to expand the cursor tag
setTimeout(() => {
    app.commands.executeCommandById("templater-obsidian:replace-templates-active-file");
}, 100);
%>
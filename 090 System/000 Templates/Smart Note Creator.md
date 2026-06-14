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

// Detection Logic
if (mocType === "project_moc") {
    templatePath = "090 System/000 Templates/Project Note Template.md";
    subFolder = "Logs"; 
    targetType = "project_note";
} else if (mocType === "uni_course_moc") {
    templatePath = "090 System/000 Templates/Uni Lecture Template.md";
    subFolder = "Lectures";
    targetType = "uni_lecture";
} else if (mocType === "course_moc") {
    templatePath = "090 System/000 Templates/Course Note Template.md";
    subFolder = "Lectures";
    targetType = "course_note";
} else {
    new Notice("Error: Active note is not a valid Course or Project MOC.");
    return;
}

const noteName = await tp.system.prompt("Note Name");
if (!noteName) return;

// Calculate next order sequence number by counting existing files of targetType
let orderDefault = "1";
const targetFolderObj = app.vault.getAbstractFileByPath(`${parentFolder}/${subFolder}`);
if (targetFolderObj && targetFolderObj.children) {
    const mdFiles = targetFolderObj.children.filter(f => {
        if (f.extension !== "md" && !f.name.endsWith(".md")) return false;
        const cache = app.metadataCache.getFileCache(f);
        return cache?.frontmatter?.type === targetType;
    });
    orderDefault = (mdFiles.length + 1).toString();
}

const order = await tp.system.prompt("Order Number", orderDefault);

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

// Create subfolder if missing
const targetPath = `${parentFolder}/${subFolder}`;
if (!app.vault.getAbstractFileByPath(targetPath)) {
    await app.vault.createFolder(targetPath);
}

// Create and Open
const finalPath = `${targetPath}/${noteName}.md`;
await app.vault.create(finalPath, content);
const newFile = app.vault.getAbstractFileByPath(finalPath);
await app.workspace.getLeaf().openFile(newFile);
%>
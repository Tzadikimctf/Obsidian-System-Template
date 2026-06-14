<%*
const projectName = await tp.system.prompt("University Course Name");
if (!projectName) return;

// 1. Semester & Academic Year Logic
const now = new Date();
const month = now.getMonth(); 
const year = now.getFullYear();
let semester = "";
let academicYear = "";

if (month >= 9 || month <= 1) { // Oct (9) to Feb (1)
    semester = "A";
    academicYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
} else if (month >= 2 && month <= 6) { // Mar (2) to Jul (6)
    semester = "B";
    academicYear = `${year - 1}-${year}`;
} else {
    semester = "Summer";
    academicYear = `${year - 1}-${year}`;
}

// 2. Fetch the Template Content
const templatePath = "090 System/000 Templates/Uni Course MOC Template.md";
const templateFile = app.vault.getAbstractFileByPath(templatePath);
if (!templateFile) {
    new Notice("Error: Uni Template not found at " + templatePath);
    return;
}
let content = await app.vault.read(templateFile);

// 3. Dynamic Replacements
content = content.replace(/{{title}}/g, projectName);
content = content.replace(/{{semester}}/g, semester);
content = content.replace(/{{academic_year}}/g, academicYear);
content = content.replace(/{{date}}/g, tp.date.now("YYYY-MM-DD"));

// 4. Folder Creation (Unified 021 University structure)
const rootPath = `021 University/${projectName}`;
const subFolders = ["Lectures", "Assignments", "Resources"];

if (!app.vault.getAbstractFileByPath(rootPath)) {
    await app.vault.createFolder(rootPath);
    for (const sub of subFolders) {
        await app.vault.createFolder(`${rootPath}/${sub}`);
    }
}

// 5. Create and Open
const mocPath = `${rootPath}/${projectName} MOC.md`;
await app.vault.create(mocPath, content);
const newFile = app.vault.getAbstractFileByPath(mocPath);
await app.workspace.getLeaf().openFile(newFile);

new Notice(`Enrolled in ${projectName} - Semester ${semester}`);
%>
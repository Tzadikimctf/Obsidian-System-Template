<%*
const courseName = await tp.system.prompt("Course Name");
if (!courseName) return;

const platform = await tp.system.prompt("Platform (e.g. YouTube, Coursera)", "YouTube");

// 1. Fetch the Template Content
const templatePath = "090 System/000 Templates/Course MOC Template.md";
const templateFile = app.vault.getAbstractFileByPath(templatePath);
if (!templateFile) {
    new Notice("Error: General Course Template not found at " + templatePath);
    return;
}
let content = await app.vault.read(templateFile);

// 2. Dynamic Replacements
content = content.replace(/{{title}}/g, courseName);
content = content.replace(/{{platform}}/g, platform);
content = content.replace(/{{date}}/g, tp.date.now("YYYY-MM-DD"));

// 3. Folder Creation
const rootPath = `020 Courses/${courseName}`;
const subFolders = ["Lectures", "Assignments", "Resources"];

if (!app.vault.getAbstractFileByPath(rootPath)) {
    await app.vault.createFolder(rootPath);
    for (const sub of subFolders) {
        await app.vault.createFolder(`${rootPath}/${sub}`);
    }
}

// 4. Create and Open
const mocPath = `${rootPath}/000 ${courseName} MOC.md`;
await app.vault.create(mocPath, content);
const newFile = app.vault.getAbstractFileByPath(mocPath);
await app.workspace.getLeaf().openFile(newFile);

new Notice(`Course ${courseName} initialized.`);
%>
<%*
const projectName = await tp.system.prompt("Project Name");
if (!projectName) return;

// 1. Tag Logic
const tagsInput = await tp.system.prompt("Tags (comma separated)", "coding, security");
const tagsFormatted = tagsInput ? tagsInput.split(',').map(t => `"${t.trim()}"`).join(", ") : "";

// 2. Fetch the Template Content
const templatePath = "090 System/000 Templates/Project MOC Template.md";
const templateFile = app.vault.getAbstractFileByPath(templatePath);
if (!templateFile) {
    new Notice("Error: Template file not found at " + templatePath);
    return;
}
let content = await app.vault.read(templateFile);

// 3. Dynamic Replacements
// This replaces placeholders in your template file with the real data
content = content.replace(/{{title}}/g, projectName);
content = content.replace(/{{tags}}/g, tagsFormatted);
content = content.replace(/{{date}}/g, tp.date.now("YYYY-MM-DD"));

// 4. Folder Creation
const rootPath = `010 Projects/Todo/${projectName}`;
const subFolders = ["attachments", "code", "archive"];

if (!app.vault.getAbstractFileByPath(rootPath)) {
    await app.vault.createFolder(rootPath);
    for (const sub of subFolders) {
        await app.vault.createFolder(`${rootPath}/${sub}`);
    }
}

// 5. Create and Open the file
const mocPath = `${rootPath}/${projectName} MOC.md`;
await app.vault.create(mocPath, content);

const newFile = app.vault.getAbstractFileByPath(mocPath);
await app.workspace.getLeaf().openFile(newFile);

new Notice(`Project ${projectName} initialized.`);
%>
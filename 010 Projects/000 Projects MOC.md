---
type: master_moc
links: "[[000 Home]]"
---
# 🚀 Project Command Center


## 📊 Project Dashboard
This view is live-synced with your project folders. Changing a status here updates the file automatically.

![[Projects Dashboard.base]]

---

> [!multi-column]
>
> > ### ➕ Quick Actions
> > 
> > *Runs the automation script to build folders and the MOC.*
> > ```meta-bind-button
> > style: primary
> > label: "Create New Project"
> > class: btn-project
> > action:
> >   type: runTemplaterFile
> >   templateFile: "090 System/000 Templates/New Project Script.md"
> > ```
> > ### 🚦 Vault Status
> > - **Inbox:** [[011 Resource Inbox]]
> > - **Knowledge:** [[090 Atlas]]
> > - **Active Projects:** (View the tab below)

---

## 💡 Workflow Tips
- **Prioritization**: Set your `priority` between **1-10**. The "ALL PROJECTS" tab sorts these descending by default.
- **Navigation**: Use **Notebook Navigator** once you jump into a specific project folder to maintain your research flow.
- **Organization**: Ensure all new projects have `type: project_moc` to appear in this dashboard.
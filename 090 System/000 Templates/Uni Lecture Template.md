---
type: uni_lecture
course: "[[<% tp.file.folder(true).split('/').pop() %>]]"
status: 🟢 Active
order: {{order}}
date_added: {{date}}
---
# {{title}}

**MOC:** [[{{parent}}]]
**Course:** [[<% tp.file.folder(true).split('/').pop() %>]]
**Lecture:** #{{order}}

---

## ✍️ Lecture Notes
<% tp.file.cursor(2) %>

---
## 🔗 Navigation
**Previous:** [[ ]] | **Next:** [[ ]]
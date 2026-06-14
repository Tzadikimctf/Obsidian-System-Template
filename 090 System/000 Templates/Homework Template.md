---
<%*
  // Get the folder path
  let path = tp.file.folder(true); 
  let folderParts = path.split('/');
  
  // Default values
  let subjectName = "General";
  let currentFolder = path || "/";

  if (folderParts.length > 0) {
    let currentName = folderParts[folderParts.length - 1];
    
    // Logic: If in 'Homework', look one level up. Otherwise, use current.
    if (currentName.toLowerCase() === "homework" && folderParts.length > 1) {
      subjectName = folderParts[folderParts.length - 2];
    } else {
      subjectName = currentName;
    }
  }
%>
type: homework
subject: "[[<% subjectName %>]]"
status: 🔴 Todo
due: 
tags:
  - Academia
links:
  - "[[<% path %>]]"
starting time: <% tp.date.now("YY/MM/DD, HH:MM") %>
teacher: name
progress: WIP
---
# <% tp.file.title %>
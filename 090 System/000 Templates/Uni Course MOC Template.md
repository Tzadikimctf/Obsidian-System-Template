---
type: uni_course_moc
student_name: 
status: "🟡 In Progress"
semester: "{{semester}}"
academic_year: "{{academic_year}}"
credits: 5
exam_date_a: 
exam_date_b: 
grade: 
subject: "[[ ]]"
date_enrolled: {{date}}
---
# 🏫 Course: {{title}}

> [!info] Academic Details
> - **Semester:** {{semester}}
> - **Academic Year:** {{academic_year}}
> - **Moed A Exam Date:** *TBD*
> - **Moed B Exam Date:** *TBD*
> - **Final Grade:** *TBD*

---

### ⚡ Quick Capture

```meta-bind-button
style: primary
label: "📓 New Lecture / Note"
class: btn-lecture
action:
  type: runTemplaterFile
  templateFile: "090 System/000 Templates/Smart Note Creator.md"
```
```meta-bind-button
style: primary
label: "📝 New Assignment"
class: btn-homework
action:
  type: runTemplaterFile
  templateFile: "090 System/000 Templates/New Homework Script.md"
```

---

## 📚 Course Content
*This view shows all lectures, assignments, and resources within this folder.*

![[University Dashboard.base#📁 THIS COURSE]]

---

## 📝 Quick Links
- [[Problem Sets]]
- [[Final Exam Prep]]
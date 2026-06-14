---
type: master_moc
links: "[[000 Home]]"
---
# 🏫 University Command Center

```dataviewjs
const courses = dv.pages('"021 University"')
    .filter(p => p.type === "uni_course_moc");

let totalCredits = 0;
let totalGradeCredits = 0;
let completedCredits = 0;
let activeCourses = 0;
let gradedCoursesCount = 0;
let totalGradeUnweighted = 0;

for (const course of courses) {
    const credits = parseFloat(course.credits) || 0;
    const grade = parseFloat(course.grade);
    
    if (course.status === "✅ Completed") {
        completedCredits += credits;
        if (!isNaN(grade)) {
            totalGradeCredits += (grade * credits);
            totalCredits += credits;
            totalGradeUnweighted += grade;
            gradedCoursesCount++;
        }
    } else if (course.status === "🟡 In Progress") {
        activeCourses++;
    }
}

const weightedGpa = totalCredits > 0 ? (totalGradeCredits / totalCredits).toFixed(2) : "N/A";
const unweightedGpa = gradedCoursesCount > 0 ? (totalGradeUnweighted / gradedCoursesCount).toFixed(2) : "N/A";

dv.paragraph(`> [!info] 📊 **Academic Performance Summary**\n> - **Weighted GPA:** \`${weightedGpa}\` (based on \`${totalCredits}\` graded credits)\n> - **Unweighted GPA:** \`${unweightedGpa}\` (based on \`${gradedCoursesCount}\` courses)\n> - **Completed Credits:** \`${completedCredits}\`\n> - **Active Courses:** \`${activeCourses}\``);
```

> [!multi-column]
>
> > ### 🎓 This Semester: Active
> > *The most urgent academic priorities for Semester {{semester}}.*
> > ![[University Dashboard.base#🎓 THIS SEMESTER]]
>
> > ### ⚙️ Academic Utilities
> > ```meta-bind-button
> > style: primary
> > label: "Enroll in New Course"
> > class: btn-course
> > action:
> >   type: runTemplaterFile
> >   templateFile: "090 System/000 Templates/New Uni Course Script.md"
> > ```
> > - [[021 University/Resources|📚 Library]]
> > - [[090 Atlas|🗺️ Knowledge Atlas]]

---

## 📜 Full Academic Record
*A complete history of all your university courses and grades.*

![[University Dashboard.base#📜 ACADEMIC RECORD]]

---

## 📅 Academic Tasks & Deadlines
```tasks
not done
path includes 021 University
group by folder
```

---

## 💡 Academic Workflow
- **Enrollment**: Use the button above. The script detects Semester A (Oct-Feb), Semester B (Mar-Jul), or Summer automatically.
- **Sequencing**: Use the `order` property in your lecture notes to maintain chronological order in the "THIS COURSE" view.
- **Finals**: Input your `exam_date` in the individual course MOC to have it appear in the "This Semester" leaderboard.
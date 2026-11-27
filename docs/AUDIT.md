# ExamVault accessibility and responsive audit

Scope covers application routes and feature components in this worktree. Findings are from source inspection and authenticated route smoke checks. Browser keyboard traversal, rendered contrast, and a full 375 px screenshot pass still need verification. Severity reflects the impact on finishing a task. The 44 px target is a mobile design goal and corresponds to WCAG 2.1 AAA criterion 2.5.5.

| Location | WCAG 2.1 criterion | Severity | Finding and exact fix |
| --- | --- | --- | --- |
| `src/app/login/login-form.tsx:56` | 1.3.1 Info and Relationships, 3.3.1 Error Identification | Major | Give both FieldError nodes stable IDs. Append the matching ID to each input's aria-describedby when invalid and focus the first invalid field after submit. |
| `src/features/exams/exam-form.tsx:101` | 1.3.1 Info and Relationships, 3.3.1 Error Identification | Major | Add stable IDs for exam setting errors and reference them from each invalid input, including dates, marks, and duration. Preserve any existing hint IDs. |
| `src/features/questions/question-form.tsx:182` | 1.3.1 Info and Relationships, 3.3.1 Error Identification | Major | Bind each option error to its input using the field-array ID. Give the options group its own error description for incorrect selection counts. |
| `src/features/users/users-manager.tsx:70` | 1.3.1 Info and Relationships, 3.3.1 Error Identification | Major | Associate each account error with the matching input in all three dialogs. Move focus to the first invalid field when submission fails. |
| `src/features/users/users-manager.tsx:230` | 3.3.2 Labels or Instructions | Minor | Add a persistent label for account search and keep the placeholder for example copy only. |
| `src/features/attempts/workspace/exam-workspace.tsx:196` | 1.3.1 Info and Relationships, 2.4.6 Headings and Labels | Major | Add an h1 containing the exam title before the first question heading. Keep question and review headings at level two. |
| `src/features/attempts/workspace/exam-workspace.tsx:572` | 2.1.2 No Keyboard Trap, 2.4.3 Focus Order | Major | Give the programmatic palette opener a trigger ref and restore focus to it after Escape or close. When selecting a question, focus its question heading instead. Verify Tab and Shift+Tab stay within the open sheet. |
| `src/features/exams/question-picker.tsx:139` | 2.5.5 Target Size (AAA) | Minor | Replace icon-xs reorder and remove controls with 44 px minimum targets on phones. Let the control cluster wrap beside the question. |
| `src/features/attempts/workspace/exam-workspace.tsx:109` | 2.5.5 Target Size (AAA) | Minor | Give palette buttons a 44 px minimum height and width. Use five columns when six targets and gaps exceed the available sheet width. |
| `src/app/admin/audit/page.tsx:20` | 1.4.10 Reflow, 2.1.1 Keyboard | Major | Give the table scroller a keyboard focus stop and an accessible region name. Allow long entity identifiers to wrap inside their cells. |
| `src/features/analytics/insights.tsx:100` | 1.4.10 Reflow, 2.1.1 Keyboard | Minor | Add a named, keyboard-focusable scroll region for both tables so readers can reach columns outside the viewport. |
| `src/features/imports/import-manager.tsx:179` | 1.4.10 Reflow | Major | Put the generated-password table in an independently scrollable region or render each account as a wrapping, labelled row at narrow widths. Keep Copy at least 44 px tall. |

## Confirmed in source

- The attempt timer has a dedicated live region for warnings, and connectivity uses text as well as color. Keep the timer's per-second display out of the live region.
- The scratchpad exposes a labelled textarea, announces save status, and uses a confirmation dialog for clearing.
- The verification form ties malformed-code feedback to the field with aria-describedby, and the result page presents a text status.
- The default muted-text and canvas OKLCH lightness values give an approximate contrast of 5.45:1 in light mode and 7.49:1 in dark mode. Confirm the rendered values across accent presets and semantic soft surfaces.
- The shared dialog and sheet primitives expose titles. Browser verification should cover initial focus, tab cycling, Escape, and focus restoration at 375 px.

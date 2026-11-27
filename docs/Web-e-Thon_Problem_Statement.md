# Secure Examination Management System

**Competition Problem Statement / Web-e-Thon**  
**Technoverse 5.0 · 27-28 November 2026 · COMSATS University Lahore**

| Development | Team Size | Evaluation |
| --- | --- | --- |
| 10 hours | 1-3 participants | 15-minute live demo |

## Document Contents

| Section | PDF Page |
| --- | ---: |
| [01 Problem Overview](#01-problem-overview) | 1 |
| [02 User Roles & Responsibilities](#02-user-roles--responsibilities) | 1 |
| [03 Core Functional Requirements](#03-core-functional-requirements) | 2-3 |
| [04 Secondary Features](#04-secondary-features) | 4 |
| [05 Open Innovation Challenges](#05-open-innovation-challenges) | 5 |
| [06 Technical Requirements & Constraints](#06-technical-requirements--constraints) | 6 |
| [07 Submission Requirements](#07-submission-requirements) | 6 |
| [08 Evaluation Criteria](#08-evaluation-criteria) | 7 |

## 01 Problem Overview

Online examinations present challenges in academic integrity, fairness, network reliability and the management of large numbers of candidates. The proposed system must address examination administration while accounting for these challenges.

Develop a full-stack web application that enables institutions and competition organizers to create, conduct, monitor and evaluate online examinations. The system must support reliable and accessible examination workflows and address at least one of the innovation challenges in Section 05.

## 02 User Roles & Responsibilities

| Role | Responsibilities |
| --- | --- |
| Administrator | Manage users, roles, access permissions and overall platform operations. |
| Examiner | Create and configure examinations, manage questions and candidates, monitor attempts, evaluate submissions and publish results. |
| Candidate | Access assigned examinations, complete and submit answers, and view published results. |

## 03 Core Functional Requirements

### Examination Setup & Access

All teams are expected to implement the following core requirements. Teams may choose their own implementation, data model and interface design.

#### 3.1 Authentication & Authorization

- Support secure authentication for administrators, examiners and candidates. Provide an appropriate experience for each role.
- Allow administrators to manage user accounts and role assignments. Enforce permissions on the backend, not merely by hiding interface elements.
- Ensure that examiners and candidates can access only examinations, records and actions for which they are authorized.

#### 3.2 Examination Management

- Allow examiners to create and configure examinations with a title, instructions, schedule, duration, total marks and relevant examination settings.
- Support the examination lifecycle, including draft, published, ongoing and completed states. Candidates must not access an examination before it is available to them.
- Allow examiners to review examination details before publication and manage their examinations through an appropriate interface.

#### 3.3 Question Management

- Provide a reusable question bank with categories or topics and difficulty levels. Allow questions to be created, edited and assigned to examinations.
- Support single-answer MCQs, multiple-select questions and written-response questions, with appropriate marking schemes.
- Allow objective questions or answer choices to be randomized where applicable. Preserve the correct marking scheme and question assignment for an active attempt.

#### 3.4 Candidate Management

- Allow examiners to enroll candidates in examinations and view enrollment information.
- Provide candidates with a clear view of their available, upcoming and completed examinations, including relevant instructions and access status.
- Restrict examination entry to eligible candidates and enforce the examination availability window.

### Examination Delivery & Results

The system must support the complete examination workflow, from candidate entry to result publication.

#### 3.5 Examination Interface

- Present questions, marks, remaining time and navigation controls in an accessible examination workspace. Distinguish answered, unanswered and marked-for-review questions.
- Automatically save answers during an attempt. Preserve previously saved progress and remaining time when the candidate refreshes or returns to the examination.
- Allow candidates to review their progress and submit their attempt. Enforce the time limit and finalize the attempt at expiry using the answers accepted within the permitted period.

#### 3.6 Examination Monitoring

- Provide examiners with a view of active attempts, their progress and relevant examination events or incidents.
- Allow examiners to monitor examination status and communicate announcements to candidates during an examination.
- Record and present relevant incidents for review. Monitoring indicators must not be treated as conclusive evidence of misconduct.

#### 3.7 Evaluation & Grading

- Automatically grade objective responses according to the configured marking scheme, including the rules for multiple-select answers.
- Allow examiners to review and manually grade written responses, with validation against the assigned marks.
- Calculate total scores accurately and maintain a consistent grading state. Examiners must be able to review results before publication.

#### 3.8 Results & Analytics

- Allow examiners to publish results in a controlled manner. Candidates must be able to view only their own published results unless authorized otherwise.
- Present meaningful examination-level performance summaries and candidate-level scores using actual submission data.
- Retain completed attempts and their results for later review by authorized users.

## 04 Secondary Features

All eight secondary features are expected. Marks are awarded for working functionality, usefulness and integration.

### 4.1 Network-Aware Interface

Detect and communicate connectivity problems and the status of answer saving or synchronization. Provide clear feedback when the connection is unstable or unavailable.

### 4.2 PDF Report Generation

Generate downloadable, readable PDF reports using actual examination and candidate performance data, with appropriate access restrictions.

### 4.3 Examination Sandbox

Allow examiners to preview and experience an examination as a candidate. Sandbox attempts must not affect real submissions, results or examination statistics.

### 4.4 Bulk Data Import

Support importing candidate records and questions from a structured file, such as CSV or JSON. Validate the data and communicate import errors clearly.

### 4.5 Question Analytics

Provide useful insights into individual question performance, such as frequently skipped questions, commonly incorrect responses or observed question difficulty.

### 4.6 Verifiable Reports

Provide a mechanism to verify the authenticity of an issued result report, such as a unique verification identifier or QR code, without exposing unnecessary candidate information.

### 4.7 Customizable Examination Workspace

Allow candidates to customize meaningful aspects of the examination workspace, including layout or viewing preferences, and retain those preferences.

### 4.8 Digital Scratchpad

Provide a dedicated space for candidates to perform rough work during an examination. The implementation may vary, but it must be usable within the examination workflow.

## 05 Open Innovation Challenges

Implement a solution to at least one of the following challenges. Teams may choose their own approach and technologies.

### 5.1 Integrity in the AI Era

AI assistants, external resources and communication tools make it increasingly difficult to conduct online examinations fairly. Develop an approach that improves examination integrity without unnecessarily compromising candidate privacy or usability.

### 5.2 Fairness of Randomized Examinations

Randomized examination papers may contain question combinations of unequal difficulty, resulting in inconsistent assessment. Develop a mechanism that improves fairness while preserving meaningful variation between papers.

### 5.3 Failure-Resilient Examinations

Internet outages, device failures and power interruptions can unfairly affect candidate performance. Design a solution that reduces the impact of these disruptions without allowing candidates to gain extra time or other unfair advantages.

### 5.4 Trust & Dispute Resolution

Candidates may dispute results due to grading errors, ambiguous questions or technical incidents. Develop a fair, transparent and accountable mechanism for resolving examination disputes while preserving the integrity of results.

### 5.5 Participant-Defined Challenge

Identify another significant problem within the online examination ecosystem and develop an original, practical solution. Explain why the problem matters, who it affects and how your solution addresses it.

### Innovation Requirements

Solutions must be functional, relevant to the application and demonstrable. Teams should explain their design decisions and trade-offs. Multiple challenges may be addressed; assessment is based on quality and effectiveness rather than quantity.

## 06 Technical Requirements & Constraints

The application must be a functional full-stack web application. Teams may choose any technology stack permitted by the competition rules.

### Security & privacy

Enforce server-side authorization. Protect credentials, answer keys, personal information and examination records. Do not expose private data through public endpoints or reports.

### Data integrity

Enforce examination timing independently of the candidate's device clock. Prevent duplicate submissions and inconsistent grading; preserve the assigned questions and marking scheme for active attempts.

### Validation & reliability

Validate inputs on the frontend and backend. Handle invalid data, interrupted requests, refreshes and repeated actions gracefully. Communicate failures and saving status clearly.

### Architecture & maintainability

Use an appropriate database design, clear separation of responsibilities and maintainable code. Be prepared to explain the technology choices and how the implementation meets requirements.

### Technical freedom & fairness

AI-assisted coding is allowed under the competition rules. AI integration is optional. No required feature may depend on paid APIs, paid API keys, proprietary datasets, specialized hardware or external services requiring billing information. Simulated services or local alternatives are acceptable where appropriate.

## 07 Submission Requirements

- Submit a Git repository containing the application source code and version history, and a deployed, functional web application.
- Include a concise README with setup instructions, test credentials for each role, any required dependencies and a description of the implemented innovation challenge(s).
- Ensure the application can be demonstrated with fictional or test data. Be ready to present the working deployed application in the 15-minute evaluation.
- Follow the official competition guide, including the submission deadline. No commits, pushes, builds or deployments may be made after the deadline; timestamp manipulation is prohibited.

## 08 Evaluation Criteria

Submissions will be evaluated according to the following criteria, for a total of 100 marks.

| Assessment category | Marks | What will be evaluated |
| --- | ---: | --- |
| Core Functionality | 30 | Completeness, correctness and integration of the core examination workflow. |
| Secondary Features | 15 | Working implementation, usefulness and integration of the eight secondary features. |
| Technical Quality & Reliability | 20 | Architecture, database design, security, validation, data integrity and handling of failure scenarios. |
| Open Innovation Challenges | 15 | Problem understanding, originality, practicality, effectiveness and implementation of participant-designed solutions. |
| UI/UX & Product Design | 20 | Intuitive workflows, feature discoverability, visual hierarchy, accessibility, responsiveness and interaction quality. |

### User Experience & Product Design

Integrate features into a consistent, accessible interface. Prioritize clear navigation, information hierarchy, responsive layouts and intuitive workflows. Avoid generic, template-like or unrefined AI-generated interfaces. Use visual elements where they support usability and clarity. AI use itself will not affect design marks.

### Fair Evaluation

- Functionality over quantity: Partial marks are available for incomplete requirements. Non-functional placeholders do not receive full functional credit.
- Technology neutrality: No extra marks merely for using AI, paid services or a particular technology. Evaluate the effectiveness of the solution.
- Consistent assessment: Judges may test common scenarios and ask teams to explain design decisions. Innovation is assessed on its merit, not the number of challenges addressed; the same implementation is not rewarded twice for the same contribution.

The evaluation includes a live demonstration and judge-led questions or testing. Detailed score sheets and test cases remain internal to the judging panel.

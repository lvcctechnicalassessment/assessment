# LVCC Assessment Portal

A secure web application for conducting Python coding examinations with real-time teacher monitoring and anti-cheat detection. 

## Features

### Roles
1. **Superadmin** – Manage teacher accounts by email
2. **Teachers** – Create coding exams with instructions, share unique links, view live dashboards
3. **Students** – Take exams in a locked Python editor (Monaco)

### Core Capabilities
- Google Sign-In restricted to school accounts 
- Teachers create exams → generate shareable link 
- Students open the link → full-screen Python editor with:
  - Syntax highlighting
  - Auto-complete & bracket matching
  - Basic static syntax checks
  - Live auto-save of every keystroke to the cloud
- **Live Teacher Dashboard**: See every student’s code in real time as they type
- **Anti-cheat notifications** when a student:
  - Copies or pastes text
  - Right-clicks
  - Switches tabs / minimizes window / loses focus
  - Attempts to close the page
  - Tries to drag-and-drop content
- Event log stored per session

## Tech Stack
- Vanilla HTML / CSS / JavaScript (no build step required)
- Firebase Authentication (Google)
- Cloud Firestore (real-time listeners)
- Monaco Editor (VS Code engine) via CDN

Built for academic integrity. Use responsibly and in accordance with institution’s policies.

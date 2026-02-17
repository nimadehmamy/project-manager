# Project Manager - TODO List

## Infrastructure & Access

- [x] **Add HTTPS/TLS support** ✅ - Self-signed certificates available via `./start-https.sh`
- [x] **Set up Tailscale** ✅ - Connected at `100.104.51.20`. Install on laptop with same account.
- [ ] **Set up nginx reverse proxy** - With basic auth as alternative access method
- [ ] **Create systemd service** - Auto-start on boot
- [ ] **Add rate limiting** - Prevent brute force on login

## Core File Management Features

- [ ] **File upload capability** - Drag-and-drop file uploads to Beast
- [ ] **File/directory creation** - Create new folders and empty files from UI
- [ ] **File deletion** - Move to trash or permanent delete with confirmation
- [ ] **File rename** - Inline renaming in the file list
- [ ] **File editing** - Simple text editor for code/config files
- [ ] **Search functionality** - Search across all project files on Beast
- [ ] **File type icons** - Better visual distinction for different file types

## Project Management Features

- [ ] **Project bookmarks** - Pin/star frequently accessed projects
- [ ] **Project notes** - Add markdown notes to each project directory
- [ ] **Project status tracking** - Mark projects as active/paused/archived
- [ ] **Recent files** - Show recently accessed files
- [ ] **Git integration** - Show git status for projects with repositories

## Multi-Server Support

- [ ] **Support multiple servers** - Configure multiple SSH hosts (Beast, others)
- [ ] **Server switcher** - UI to switch between different servers
- [ ] **Unified view** - See projects across multiple servers

## UI/UX Improvements

- [x] **Project Dashboard Layout** - Three-panel layout (projects left, main center, chat right)
  - [x] Left panel: Project browser (GitHub-style directory listing) with expandable subdirectories
  - [x] Main panel: Tabbed interface (Summary, Todos, Files)
  - [x] Summary tab: Render README.md
  - [x] Todos tab: Render TODO.md  
  - [x] Files tab: Current file browser with popup
  - [x] Right panel: Chat window placeholder
- [x] **File Viewer Popup** - Large modal (95% width, 90% height)
  - [x] Render markdown files with marked.js
  - [x] Syntax highlighting with Prism.js (tomorrow theme)
  - [x] Supports Python, JS, CSS, JSON, YAML, Bash, and more
- [x] **Login Page** - Fixed styling with gradient background
- [ ] **Dark mode** - Toggle between light and dark themes
- [ ] **File previews** - Image preview, syntax-highlighted code view
- [ ] **Bulk operations** - Select multiple files for download/delete
- [ ] **Progress indicators** - Show upload/download progress
- [ ] **Keyboard shortcuts** - Vim-style navigation, quick actions

## Testing & Documentation

- [ ] **Unit tests** - Backend API tests
- [ ] **Integration tests** - SSH connection, file operations
- [ ] **Deployment guide** - Step-by-step for different setups
- [ ] **Docker support** - Containerize the application

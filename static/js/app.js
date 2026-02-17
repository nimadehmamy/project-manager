/**
 * Project Manager - Dashboard Application
 */

// State
let currentProject = null;
let currentPath = '/';
let currentTab = 'summary';

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    loadProjects();
    setupEventListeners();
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadProjects();
        if (currentProject) {
            loadProjectContent(currentProject);
        }
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('previewModal').addEventListener('click', (e) => {
        if (e.target.id === 'previewModal') closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Track expanded directories
let expandedDirs = new Set();

/**
 * Load all projects (directories in configured path)
 */
async function loadProjects(path = '/') {
    const projectList = document.getElementById('projectList');
    
    // Only show loading on initial load
    if (path === '/') {
        projectList.innerHTML = '<div class="loading">Loading projects...</div>';
    }

    try {
        const response = await fetch(`/api/projects?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.error) {
            if (path === '/') {
                projectList.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error)}</div>`;
            }
            return [];
        }

        // Only render root level initially
        if (path === '/') {
            renderProjectTree(data.projects);
            document.getElementById('projectCount').textContent = countAllProjects(data.projects);
        }
        
        return data.projects;

    } catch (err) {
        if (path === '/') {
            projectList.innerHTML = `<div class="empty-state">Failed to load projects</div>`;
        }
        return [];
    }
}

/**
 * Count all projects including nested ones
 */
function countAllProjects(projects) {
    let count = projects.length;
    projects.forEach(p => {
        if (p.children && p.children.length > 0) {
            count += countAllProjects(p.children);
        }
    });
    return count;
}

/**
 * Render project tree with expandable folders
 */
function renderProjectTree(projects, container = null, level = 0, parentPath = '') {
    const projectList = container || document.getElementById('projectList');
    
    if (!container && projects.length === 0) {
        projectList.innerHTML = '<div class="empty-state">No projects found</div>';
        return;
    }

    // Create tree list
    const treeList = document.createElement('ul');
    treeList.className = 'project-tree';
    if (level > 0) treeList.style.paddingLeft = '12px';

    projects.forEach(project => {
        const li = document.createElement('li');
        li.className = 'tree-item';
        
        const hasChildren = project.has_children;
        const isExpanded = expandedDirs.has(project.path);
        
        // Build indicators
        const indicators = [];
        if (project.has_readme) indicators.push('<span class="indicator has-readme">R</span>');
        if (project.has_todo) indicators.push('<span class="indicator has-todo">T</span>');
        
        // Toggle icon
        let toggleClass = 'tree-toggle';
        if (!hasChildren) {
            toggleClass += ' leaf';
        } else if (isExpanded) {
            toggleClass += ' expanded';
        } else {
            toggleClass += ' collapsed';
        }
        
        li.innerHTML = `
            <div class="tree-content ${currentProject === project.path ? 'selected' : ''}" 
                 data-project="${escapeHtml(project.path)}" 
                 data-name="${escapeHtml(project.name)}">
                <span class="${toggleClass}"></span>
                <span class="tree-icon">📁</span>
                <span class="tree-label">${escapeHtml(project.name)}</span>
                <div class="tree-meta">
                    <div class="tree-indicators">${indicators.join('')}</div>
                </div>
            </div>
            <div class="tree-children" style="display: ${isExpanded ? 'block' : 'none'}"></div>
        `;
        
        // Add click handler for selection
        const content = li.querySelector('.tree-content');
        content.addEventListener('click', (e) => {
            // If clicked on toggle, expand/collapse instead
            if (e.target.classList.contains('tree-toggle') && hasChildren) {
                e.stopPropagation();
                toggleDirectory(project.path, li);
                return;
            }
            
            // Select project
            document.querySelectorAll('.tree-content').forEach(c => c.classList.remove('selected'));
            content.classList.add('selected');
            selectProject(project.path, project.name);
        });
        
        // If already expanded and has children, load them
        if (isExpanded && hasChildren) {
            const childrenContainer = li.querySelector('.tree-children');
            loadDirectoryChildren(project.path, childrenContainer);
        }
        
        treeList.appendChild(li);
    });

    if (container) {
        container.innerHTML = '';
        container.appendChild(treeList);
    } else {
        projectList.innerHTML = '';
        projectList.appendChild(treeList);
    }
}

/**
 * Toggle directory expand/collapse
 */
async function toggleDirectory(path, treeItem) {
    const childrenContainer = treeItem.querySelector('.tree-children');
    const toggle = treeItem.querySelector('.tree-toggle');
    const isExpanded = expandedDirs.has(path);
    
    if (isExpanded) {
        // Collapse
        expandedDirs.delete(path);
        childrenContainer.style.display = 'none';
        toggle.classList.remove('expanded');
        toggle.classList.add('collapsed');
    } else {
        // Expand
        expandedDirs.add(path);
        childrenContainer.style.display = 'block';
        toggle.classList.remove('collapsed');
        toggle.classList.add('expanded');
        
        // Load children if not already loaded
        if (!childrenContainer.dataset.loaded) {
            await loadDirectoryChildren(path, childrenContainer);
            childrenContainer.dataset.loaded = 'true';
        }
    }
}

/**
 * Load children of a directory
 */
async function loadDirectoryChildren(path, container) {
    container.innerHTML = '<div class="loading" style="padding: 8px 16px; font-size: 0.8rem;">Loading...</div>';
    
    try {
        const response = await fetch(`/api/projects?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (data.error || !data.projects || data.projects.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        renderProjectTree(data.projects, container, 1, path);
        
    } catch (err) {
        container.innerHTML = '<div style="padding: 8px 16px; color: var(--text-muted); font-size: 0.8rem;">Failed to load</div>';
    }
}

/**
 * Legacy: Render flat project list (kept for compatibility)
 */
function renderProjectList(projects) {
    renderProjectTree(projects);
}

/**
 * Select a project and load its content
 */
function selectProject(projectPath, projectName) {
    currentProject = projectPath;
    currentPath = projectPath;
    
    // Update document title
    document.title = `${projectName} - Project Manager`;
    
    // Load project content based on current tab
    loadProjectContent(projectPath);
}

/**
 * Load content for the current project based on active tab
 */
async function loadProjectContent(projectPath) {
    if (!projectPath) return;

    switch (currentTab) {
        case 'summary':
            await loadReadme(projectPath);
            break;
        case 'todos':
            await loadTodo(projectPath);
            break;
        case 'progress':
            await loadProgress(projectPath);
            break;
        case 'files':
            await loadDirectory(projectPath);
            break;
    }
}

/**
 * Switch between tabs
 */
function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tab}`);
    });

    // Load content if needed
    if (currentProject) {
        loadProjectContent(currentProject);
    }
}

/**
 * Load and render README.md
 */
async function loadReadme(projectPath) {
    const contentDiv = document.getElementById('readmeContent');
    contentDiv.innerHTML = '<div class="loading">Loading README...</div>';

    try {
        const response = await fetch(`/api/project/readme?project=${encodeURIComponent(projectPath)}`);
        const data = await response.json();

        if (data.error) {
            contentDiv.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error)}</div>`;
            return;
        }

        if (!data.found) {
            contentDiv.innerHTML = `
                <div class="empty-state">
                    <p>No README.md found in this project</p>
                    <p class="placeholder-hint">Add a README.md to see project documentation</p>
                </div>
            `;
            return;
        }

        // Render markdown
        contentDiv.innerHTML = marked.parse(data.content);

    } catch (err) {
        contentDiv.innerHTML = `<div class="empty-state">Failed to load README</div>`;
    }
}

/**
 * Load and render TODO.md
 */
async function loadTodo(projectPath) {
    const contentDiv = document.getElementById('todoContent');
    contentDiv.innerHTML = '<div class="loading">Loading TODOs...</div>';

    try {
        const response = await fetch(`/api/project/todo?project=${encodeURIComponent(projectPath)}`);
        const data = await response.json();

        if (data.error) {
            contentDiv.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error)}</div>`;
            return;
        }

        if (!data.found) {
            contentDiv.innerHTML = `
                <div class="empty-state">
                    <p>No TODO.md found in this project</p>
                    <p class="placeholder-hint">Add a TODO.md to track tasks and progress</p>
                </div>
            `;
            return;
        }

        // Render markdown
        contentDiv.innerHTML = marked.parse(data.content);

    } catch (err) {
        contentDiv.innerHTML = `<div class="empty-state">Failed to load TODOs</div>`;
    }
}

/**
 * Load directory contents (Files tab)
 */
async function loadDirectory(path) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<div class="loading">Loading files...</div>';

    try {
        const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.error) {
            fileList.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error)}</div>`;
            return;
        }

        currentPath = data.path;
        renderBreadcrumb(currentPath);
        renderFileList(data.entries, data.parent);

    } catch (err) {
        fileList.innerHTML = `<div class="empty-state">Failed to load files</div>`;
    }
}

/**
 * Render breadcrumb navigation
 */
function renderBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    
    // Get project name from current project
    const projectName = currentProject ? currentProject.split('/').pop() : 'Project';
    
    const parts = path.split('/').filter(p => p);
    
    let html = '<span class="breadcrumb-item"><a href="#" data-path="/">Home</a></span>';
    
    let currentBuild = '';
    parts.forEach((part, index) => {
        currentBuild += '/' + part;
        const isLast = index === parts.length - 1;
        html += '<span class="breadcrumb-separator">/</span>';
        if (isLast) {
            html += `<span class="breadcrumb-item">${escapeHtml(part)}</span>`;
        } else {
            html += `<span class="breadcrumb-item"><a href="#" data-path="${currentBuild}">${escapeHtml(part)}</a></span>`;
        }
    });

    breadcrumb.innerHTML = html;

    // Add click handlers
    breadcrumb.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadDirectory(e.target.dataset.path);
        });
    });
}

/**
 * Render file list (GitHub style)
 */
function renderFileList(entries, parentPath) {
    const fileList = document.getElementById('fileList');

    if (entries.length === 0 && !parentPath) {
        fileList.innerHTML = '<div class="empty-state">This directory is empty</div>';
        return;
    }

    let html = `
        <div class="file-list-header">
            <span>Name</span>
            <span>Size</span>
            <span>Modified</span>
        </div>
    `;

    // Parent directory link
    if (parentPath !== null && parentPath !== undefined) {
        html += `
            <div class="file-item" data-path="${escapeHtml(parentPath)}" data-is-dir="true">
                <div class="file-name">
                    <span class="file-icon folder">⬆️</span>
                    <span>..</span>
                </div>
                <span class="file-size">-</span>
                <span class="file-modified">-</span>
            </div>
        `;
    }

    entries.forEach(entry => {
        const icon = entry.is_dir ? '📁' : getFileIcon(entry.name);
        const iconClass = entry.is_dir ? 'folder' : 'file';
        const size = entry.is_dir ? '-' : formatFileSize(entry.size);

        html += `
            <div class="file-item" data-path="${escapeHtml(entry.path)}" data-is-dir="${entry.is_dir}">
                <div class="file-name">
                    <span class="file-icon ${iconClass}">${icon}</span>
                    <span>${escapeHtml(entry.name)}</span>
                </div>
                <span class="file-size">${size}</span>
                <span class="file-modified">${escapeHtml(entry.modified)}</span>
            </div>
        `;
    });

    fileList.innerHTML = html;

    // Add click handlers
    fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const path = item.dataset.path;
            const isDir = item.dataset.isDir === 'true';

            if (isDir) {
                loadDirectory(path);
            } else {
                previewFile(path);
            }
        });
    });
}

/**
 * Preview a file with syntax highlighting or markdown rendering
 */
async function previewFile(path) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewTitle');
    const content = document.getElementById('previewContent');
    const downloadBtn = document.getElementById('downloadBtn');
    const modalBody = modal.querySelector('.modal-body');

    const fileName = path.split('/').pop();
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    title.innerHTML = `<span class="file-icon">${getFileIcon(fileName)}</span> ${escapeHtml(fileName)}`;
    content.innerHTML = '<div class="loading">Loading...</div>';
    modal.classList.add('active');
    modalBody.className = 'modal-body'; // Reset classes

    // Set download link
    downloadBtn.href = `/api/file?path=${encodeURIComponent(path)}&download=true`;

    try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
        
        if (!response.ok) {
            const data = await response.json();
            content.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error || 'Failed to load file')}</div>`;
            return;
        }

        let text = await response.text();
        
        // Limit preview size
        const maxLength = 500000;
        let truncated = false;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
            truncated = true;
        }

        // Check if it's a markdown file
        if (fileExt === 'md' || fileExt === 'markdown') {
            // Render as markdown
            modalBody.classList.add('markdown-rendered');
            content.innerHTML = marked.parse(text);
            if (truncated) {
                content.innerHTML += '<div class="empty-state" style="margin-top: 20px; padding: 20px; border-top: 1px solid var(--border);">[File truncated. Use Download to view full file.]</div>';
            }
        } else {
            // Render as code with syntax highlighting
            const language = getPrismLanguage(fileExt);
            modalBody.classList.remove('markdown-rendered');
            
            let html = '';
            if (language) {
                html = `<pre class="language-${language}"><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
            } else {
                html = `<pre class="plain-text"><code>${escapeHtml(text)}</code></pre>`;
            }
            
            if (truncated) {
                html += '<div class="empty-state" style="padding: 20px; border-top: 1px solid var(--border);">[File truncated. Use Download to view full file.]</div>';
            }
            
            content.innerHTML = html;
            
            // Apply syntax highlighting
            if (language && window.Prism) {
                Prism.highlightAll();
            }
        }
    } catch (err) {
        content.innerHTML = `<div class="empty-state">Error loading file: ${escapeHtml(err.message)}</div>`;
    }
}

/**
 * Get Prism.js language identifier from file extension
 */
function getPrismLanguage(ext) {
    const languageMap = {
        'py': 'python',
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'jsx',
        'tsx': 'tsx',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'markdown': 'markdown',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'rs': 'rust',
        'go': 'go',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'r': 'r',
        'm': 'matlab',
        'pl': 'perl',
        'lua': 'lua',
        'vim': 'vim',
        'dockerfile': 'docker',
        'sql': 'sql',
        'tex': 'latex',
    };
    
    return languageMap[ext] || null;
}

/**
 * Close the preview modal
 */
function closeModal() {
    const modal = document.getElementById('previewModal');
    modal.classList.remove('active');
    // Reset modal body classes
    const modalBody = modal.querySelector('.modal-body');
    modalBody.className = 'modal-body';
}

/**
 * Get appropriate icon for file type
 */
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const icons = {
        'py': '🐍',
        'js': '📜',
        'html': '🌐',
        'css': '🎨',
        'md': '📝',
        'txt': '📄',
        'json': '📋',
        'yaml': '⚙️',
        'yml': '⚙️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'pdf': '📕',
        'zip': '📦',
        'tar': '📦',
        'gz': '📦',
    };

    return icons[ext] || '📄';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '-';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ==========================================
// Progress/Tasks Tracker
// ==========================================

let currentProgressData = null;
let progressExpandedTasks = new Set();

/**
 * Load and render Progress data
 */
async function loadProgress(projectPath) {
    const contentDiv = document.getElementById('progressContent');
    contentDiv.innerHTML = '<div class="loading">Loading progress...</div>';

    try {
        const response = await fetch(`/api/project/progress?project=${encodeURIComponent(projectPath)}`);
        const data = await response.json();

        if (data.error) {
            contentDiv.innerHTML = `<div class="empty-state">Error: ${escapeHtml(data.error)}</div>`;
            return;
        }

        currentProgressData = data.data;

        if (!data.dir_exists) {
            renderProgressInit(contentDiv, projectPath);
            return;
        }

        if (!data.found) {
            // Directory exists but no tasks.yml yet
            await initProgress(projectPath, currentProject.split('/').pop());
            return;
        }

        renderProgressTracker(contentDiv, data.data, projectPath);

    } catch (err) {
        contentDiv.innerHTML = `<div class="empty-state">Failed to load progress: ${escapeHtml(err.message)}</div>`;
    }
}

/**
 * Render the "Initialize Progress" view
 */
function renderProgressInit(container, projectPath) {
    const projectName = currentProject ? currentProject.split('/').pop() : 'Project';
    
    container.innerHTML = `
        <div class="progress-init">
            <div class="progress-init-icon">📊</div>
            <h3>Track Your Progress</h3>
            <p>Create a task tracker for "${escapeHtml(projectName)}" to monitor<br>status, add subtasks, and track completion.</p>
            <button class="btn btn-primary" onclick="initProgress('${escapeHtml(projectPath)}', '${escapeHtml(projectName)}')">
                Create Task Tracker
            </button>
        </div>
    `;
}

/**
 * Initialize progress tracking for a project
 */
async function initProgress(projectPath, projectName) {
    const contentDiv = document.getElementById('progressContent');
    contentDiv.innerHTML = '<div class="loading">Creating task tracker...</div>';

    try {
        const response = await fetch('/api/project/progress/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: projectPath, name: projectName })
        });

        const data = await response.json();

        if (data.success) {
            currentProgressData = data.data;
            renderProgressTracker(contentDiv, data.data, projectPath);
        } else {
            contentDiv.innerHTML = `<div class="empty-state">Failed to create tracker: ${escapeHtml(data.error)}</div>`;
        }
    } catch (err) {
        contentDiv.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    }
}

/**
 * Render the full progress tracker
 */
function renderProgressTracker(container, data, projectPath) {
    const tasks = data.tasks || [];
    const stats = calculateProgressStats(tasks);
    
    let html = `
        <div class="progress-container">
            <div class="progress-header">
                <div class="progress-title">📊 ${escapeHtml(data.project?.name || 'Project')} Progress</div>
                <div class="progress-actions">
                    <button class="btn btn-primary" onclick="showAddTaskForm()">+ Add Task</button>
                </div>
            </div>
            
            <div class="progress-stats">
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: var(--accent-green);">${stats.completed}</div>
                    <div class="stat-label">Done</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: var(--accent-blue);">${stats.inProgress}</div>
                    <div class="stat-label">In Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.percentage}%</div>
                    <div class="stat-label">Complete</div>
                </div>
            </div>
            
            <div class="progress-bar-container" style="margin-bottom: 24px;">
                <div class="progress-bar" style="width: ${stats.percentage}%"></div>
            </div>
            
            <div id="addTaskForm" style="display: none;">
                ${renderAddTaskForm()}
            </div>
            
            <ul class="task-tree">
                ${renderTaskList(tasks, projectPath)}
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Calculate progress statistics
 */
function calculateProgressStats(tasks) {
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    
    function countTask(task) {
        total++;
        if (task.status === 'completed') completed++;
        else if (task.status === 'in_progress') inProgress++;
        
        if (task.subtasks) {
            task.subtasks.forEach(countTask);
        }
    }
    
    tasks.forEach(countTask);
    
    return {
        total,
        completed,
        inProgress,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

/**
 * Render the add task form
 */
function renderAddTaskForm() {
    return `
        <div class="add-task-form">
            <h4>Add New Task</h4>
            <div class="form-row">
                <input type="text" id="newTaskName" placeholder="Task name..." style="flex: 2;">
                <select id="newTaskStatus">
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>
            <div class="form-row">
                <textarea id="newTaskDescription" placeholder="Description (optional)..." style="flex: 1;"></textarea>
            </div>
            <div class="form-row" style="justify-content: flex-end;">
                <button class="btn" onclick="hideAddTaskForm()">Cancel</button>
                <button class="btn btn-primary" onclick="addTask()">Add Task</button>
            </div>
        </div>
    `;
}

/**
 * Render the task list recursively
 */
function renderTaskList(tasks, projectPath, parentId = null) {
    if (!tasks || tasks.length === 0) {
        return '<li class="progress-empty">No tasks yet. Click "Add Task" to get started!</li>';
    }
    
    return tasks.map((task, index) => {
        const taskId = parentId ? `${parentId}.${index}` : `${index}`;
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const isExpanded = progressExpandedTasks.has(taskId);
        
        const toggleClass = hasSubtasks 
            ? (isExpanded ? 'task-toggle expanded' : 'task-toggle collapsed')
            : 'task-toggle leaf';
        
        const statusClass = task.status || 'not_started';
        const statusLabel = formatStatusLabel(task.status);
        
        let html = `
            <li class="task-item" data-task-id="${taskId}">
                <div class="task-content">
                    <span class="${toggleClass}" onclick="toggleTask('${taskId}')"></span>
                    <input type="checkbox" class="task-checkbox" 
                        ${task.status === 'completed' ? 'checked' : ''} 
                        onchange="toggleTaskComplete('${taskId}', this.checked)">
                    <div class="task-main">
                        <div class="task-header">
                            <span class="task-name ${task.status === 'completed' ? 'completed' : ''}">${escapeHtml(task.name)}</span>
                            <select class="task-status ${statusClass}" onchange="updateTaskStatus('${taskId}', this.value)">
                                <option value="not_started" ${task.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                                <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                                <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="task-btn" onclick="showAddSubtaskForm('${taskId}')">+ Subtask</button>
                        <button class="task-btn delete" onclick="deleteTask('${taskId}')">🗑</button>
                    </div>
                </div>
                ${hasSubtasks ? `
                    <ul class="task-subtasks" id="subtasks-${taskId}" style="display: ${isExpanded ? 'block' : 'none'};">
                        ${renderTaskList(task.subtasks, projectPath, taskId)}
                    </ul>
                ` : ''}
            </li>
        `;
        
        return html;
    }).join('');
}

/**
 * Format status label
 */
function formatStatusLabel(status) {
    const labels = {
        'not_started': 'Not Started',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'blocked': 'Blocked',
        'cancelled': 'Cancelled'
    };
    return labels[status] || 'Not Started';
}

/**
 * Toggle task expansion
 */
function toggleTask(taskId) {
    if (progressExpandedTasks.has(taskId)) {
        progressExpandedTasks.delete(taskId);
    } else {
        progressExpandedTasks.add(taskId);
    }
    // Re-render
    if (currentProject) {
        loadProgress(currentProject);
    }
}

/**
 * Toggle task completion via checkbox
 */
async function toggleTaskComplete(taskId, isComplete) {
    const newStatus = isComplete ? 'completed' : 'not_started';
    await updateTaskStatus(taskId, newStatus);
}

/**
 * Update task status
 */
async function updateTaskStatus(taskId, newStatus) {
    if (!currentProgressData || !currentProject) return;
    
    // Find and update the task
    const task = findTaskById(currentProgressData.tasks, taskId);
    if (task) {
        task.status = newStatus;
        await saveProgress();
        // Re-render to show changes
        loadProgress(currentProject);
    }
}

/**
 * Find a task by its ID
 */
function findTaskById(tasks, taskId) {
    const indices = taskId.split('.').map(Number);
    let current = tasks;
    
    for (const index of indices) {
        if (!current || !current[index]) return null;
        if (indices.indexOf(index) === indices.length - 1) {
            return current[index];
        }
        current = current[index].subtasks;
    }
    
    return null;
}

/**
 * Show add task form
 */
function showAddTaskForm() {
    const form = document.getElementById('addTaskForm');
    if (form) {
        form.style.display = 'block';
        document.getElementById('newTaskName').focus();
    }
}

/**
 * Hide add task form
 */
function hideAddTaskForm() {
    const form = document.getElementById('addTaskForm');
    if (form) {
        form.style.display = 'none';
        // Clear inputs
        document.getElementById('newTaskName').value = '';
        document.getElementById('newTaskDescription').value = '';
        document.getElementById('newTaskStatus').value = 'not_started';
    }
}

/**
 * Add a new task
 */
async function addTask() {
    const name = document.getElementById('newTaskName').value.trim();
    const status = document.getElementById('newTaskStatus').value;
    const description = document.getElementById('newTaskDescription').value.trim();
    
    if (!name) {
        alert('Please enter a task name');
        return;
    }
    
    if (!currentProgressData) return;
    
    const newTask = {
        id: Date.now().toString(),
        name: name,
        status: status,
        description: description,
        created: new Date().toISOString(),
        subtasks: []
    };
    
    currentProgressData.tasks.push(newTask);
    
    await saveProgress();
    hideAddTaskForm();
    loadProgress(currentProject);
}

/**
 * Delete a task
 */
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    if (!currentProgressData) return;
    
    // Remove task from data
    currentProgressData.tasks = removeTaskById(currentProgressData.tasks, taskId);
    
    await saveProgress();
    loadProgress(currentProject);
}

/**
 * Remove task by ID from task list
 */
function removeTaskById(tasks, taskId) {
    const indices = taskId.split('.').map(Number);
    
    if (indices.length === 1) {
        // Top-level task
        tasks.splice(indices[0], 1);
        return tasks;
    }
    
    // Navigate to parent
    let current = tasks;
    for (let i = 0; i < indices.length - 1; i++) {
        current = current[indices[i]].subtasks;
    }
    
    // Remove from parent
    current[indices[indices.length - 1]].subtasks.splice(indices[indices.length - 1], 1);
    return tasks;
}

/**
 * Save progress to server
 */
async function saveProgress() {
    if (!currentProject || !currentProgressData) return;
    
    try {
        const response = await fetch('/api/project/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project: currentProject,
                data: currentProgressData
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Failed to save progress:', data.error);
        }
    } catch (err) {
        console.error('Error saving progress:', err);
    }
}

/**
 * Show add subtask form (simplified - just adds to top for now)
 */
function showAddSubtaskForm(parentTaskId) {
    // For now, just show the add task form
    // Subtask functionality can be added later
    showAddTaskForm();
}

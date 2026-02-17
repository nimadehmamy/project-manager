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
 * Load all projects (directories in __work/)
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

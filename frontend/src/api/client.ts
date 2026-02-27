import axios, { type AxiosInstance, type AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(username: string, password: string) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    return this.client.post('/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async logout() {
    return this.client.get('/logout');
  }

  // Projects
  async getProjects(path: string = '/') {
    const response = await this.client.get(`/api/projects?path=${encodeURIComponent(path)}`);
    return response.data;
  }

  // Files
  async browseDirectory(path: string) {
    const response = await this.client.get(`/api/browse?path=${encodeURIComponent(path)}`);
    return response.data;
  }

  async getTree(path: string) {
    const response = await this.client.get(`/api/tree?path=${encodeURIComponent(path)}`);
    return response.data;
  }

  async getFile(path: string, download: boolean = false) {
    const response = await this.client.get(
      `/api/file?path=${encodeURIComponent(path)}&download=${download}`,
      { responseType: download ? 'blob' : 'text' }
    );
    return response.data;
  }

  async saveFile(path: string, content: string) {
    const response = await this.client.put('/api/file', { path, content });
    return response.data;
  }

  // Project Content
  async getReadme(project: string) {
    const response = await this.client.get(`/api/project/readme?project=${encodeURIComponent(project)}`);
    return response.data;
  }

  async getTodo(project: string) {
    const response = await this.client.get(`/api/project/todo?project=${encodeURIComponent(project)}`);
    return response.data;
  }

  // Progress
  async getProgress(project: string) {
    const response = await this.client.get(`/api/project/progress?project=${encodeURIComponent(project)}`);
    return response.data;
  }

  async saveProgress(project: string, data: any) {
    const response = await this.client.post('/api/project/progress', {
      project,
      data,
    });
    return response.data;
  }

  async initProgress(project: string, name: string) {
    const response = await this.client.post('/api/project/progress/init', {
      project,
      name,
    });
    return response.data;
  }

  // Managed Projects (Home Dashboard)
  async getManagedProjects() {
    const response = await this.client.get('/api/projects/managed');
    return response.data;
  }

  // Stats
  async getStats() {
    const response = await this.client.get('/api/stats');
    return response.data;
  }

  // Profile
  async getProfile() {
    const response = await this.client.get('/api/profile');
    return response.data;
  }

  async updateProfile(currentPassword: string, newUsername?: string, newPassword?: string) {
    const response = await this.client.post('/api/profile', {
      current_password: currentPassword,
      new_username: newUsername,
      new_password: newPassword,
    });
    return response.data;
  }

  // Zellij
  async getZellijStatus() {
    const response = await this.client.get('/api/zellij/status');
    return response.data;
  }

  async getZellijSessions() {
    const response = await this.client.get('/api/zellij/sessions');
    return response.data;
  }

  async getProjectZellijSession(project: string) {
    const response = await this.client.get(`/api/zellij/project-session?project=${encodeURIComponent(project)}`);
    return response.data;
  }

  async bindZellijSession(project: string, sessionName: string) {
    const response = await this.client.post('/api/zellij/bind', {
      project,
      session_name: sessionName,
    });
    return response.data;
  }

  async createZellijSession(project: string, agentType: string = 'claude') {
    const response = await this.client.post('/api/zellij/create', {
      project,
      agent_type: agentType,
    });
    return response.data;
  }

  // WebSocket for terminal
  createTerminalWebSocket(): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    return new WebSocket(wsUrl);
  }
}

export const api = new ApiClient();

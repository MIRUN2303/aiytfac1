const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const separator = path.startsWith("/") ? "" : "/";
  return `${API}${separator}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Projects
export const getProjects = (params?: string) => request<any[]>(`/projects/${params || ""}`);
export const getProject = (id: number) => request<any>(`/projects/${id}`);
export const createProject = (data: any) => request<any>("/projects/", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: number, data: any) => request<any>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteProject = (id: number) => request<any>(`/projects/${id}`, { method: "DELETE" });
export const duplicateProject = (id: number) => request<any>(`/projects/${id}/duplicate`, { method: "POST" });
export const cancelProject = (id: number) => request<any>(`/projects/${id}/cancel`, { method: "POST" });
export const archiveProject = (id: number) => request<any>(`/projects/${id}/archive`, { method: "POST" });
export const rerenderProject = (id: number) => request<any>(`/projects/${id}/rerender`, { method: "POST" });
export const getProjectFiles = (id: number) => request<any>(`/projects/${id}/files`);
export const getProjectLogs = (id: number) => request<any>(`/projects/${id}/logs`);

// Settings
export const getSettings = () => request<any>("/settings/");
export const updateSettings = (data: any) => request<any>("/settings/", { method: "POST", body: JSON.stringify(data) });
export const getSetting = (key: string) => request<any>(`/settings/${key}`);
export const updateSetting = (key: string, value: any) => request<any>(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) });

// Queue
export const getQueueStatus = () => request<any>("/queue/");
export const getActiveJobs = () => request<any>("/queue/active");
export const clearQueue = () => request<any>("/queue/clear", { method: "POST" });
export const retryJob = (id: number) => request<any>(`/queue/retry/${id}`, { method: "POST" });

// System
export const getSystemStatus = () => request<any>("/system/status");
export const getSystemStats = () => request<any>("/system/stats");
export const getWorkerStatus = () => request<any>("/system/worker");
export const getSystemLogs = () => request<any>("/system/logs");
export const restartWorkers = () => request<any>("/system/worker/restart", { method: "POST" });
export const setWorkerCount = (count: number) => request<any>("/system/worker/set-count", { method: "POST", body: JSON.stringify({ count }) });

// Plugins
export const getPlugins = () => request<any[]>("/plugins/");
export const createPlugin = (data: any) => request<any>("/plugins/", { method: "POST", body: JSON.stringify(data) });
export const updatePlugin = (id: number, data: any) => request<any>(`/plugins/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deletePlugin = (id: number) => request<any>(`/plugins/${id}`, { method: "DELETE" });
export const testPlugin = (id: number) => request<any>(`/plugins/${id}/test`, { method: "POST" });

// Schedules
export const getSchedules = () => request<any[]>("/scheduler/");
export const createSchedule = (data: any) => request<any>("/scheduler/", { method: "POST", body: JSON.stringify(data) });
export const updateSchedule = (id: number, data: any) => request<any>(`/scheduler/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteSchedule = (id: number) => request<any>(`/scheduler/${id}`, { method: "DELETE" });
export const runScheduleNow = (id: number) => request<any>(`/scheduler/${id}/run-now`, { method: "POST" });

// Uploads
export const getUploads = () => request<any[]>("/uploads/");
export const getUploadHistory = () => request<any>("/uploads/history");
export const getUpload = (id: number) => request<any>(`/uploads/${id}`);
export const uploadToYoutube = (projectId: number) => request<any>("/uploads/youtube", { method: "POST", body: JSON.stringify({ project_id: projectId }) });

// Health
export const getHealth = () => request<any>("/health");

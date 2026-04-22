const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("cms_token");
}

export function setToken(token: string) {
  localStorage.setItem("cms_token", token);
}

export function clearToken() {
  localStorage.removeItem("cms_token");
}

export function isLoggedIn() {
  return !!getToken();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/login`;
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data as T;
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await request<{ accessToken: string; user: any; message: string }>(
      "POST",
      "/auth/login",
      { email, password }
    );
    return { token: res.accessToken, user: res.user };
  },

  me: () => request<any>("GET", "/auth/user"),

  // Stats
  cmsStats: () => request<any>("GET", "/cms/stats"),

  // Pages
  getPages: () => request<any[]>("GET", "/cms/pages"),
  getPage: (id: number) => request<any>("GET", `/cms/pages/${id}`),
  createPage: (data: any) => request<any>("POST", "/cms/pages", data),
  updatePage: (id: number, data: any) =>
    request<any>("PUT", `/cms/pages/${id}`, data),
  deletePage: (id: number) => request<any>("DELETE", `/cms/pages/${id}`),

  // Posts
  getPosts: () => request<any[]>("GET", "/cms/posts"),
  getPost: (id: number) => request<any>("GET", `/cms/posts/${id}`),
  createPost: (data: any) => request<any>("POST", "/cms/posts", data),
  updatePost: (id: number, data: any) =>
    request<any>("PUT", `/cms/posts/${id}`, data),
  deletePost: (id: number) => request<any>("DELETE", `/cms/posts/${id}`),

  // Team Members
  getTeamMembers: () => request<any[]>("GET", "/cms/team-members"),
  getTeamMember: (id: number) =>
    request<any>("GET", `/cms/team-members/${id}`),
  createTeamMember: (data: any) =>
    request<any>("POST", "/cms/team-members", data),
  updateTeamMember: (id: number, data: any) =>
    request<any>("PUT", `/cms/team-members/${id}`, data),
  deleteTeamMember: (id: number) =>
    request<any>("DELETE", `/cms/team-members/${id}`),

  // Services
  getServices: () => request<any[]>("GET", "/cms/services"),
  getService: (id: number) => request<any>("GET", `/cms/services/${id}`),
  createService: (data: any) => request<any>("POST", "/cms/services", data),
  updateService: (id: number, data: any) =>
    request<any>("PUT", `/cms/services/${id}`, data),
  deleteService: (id: number) =>
    request<any>("DELETE", `/cms/services/${id}`),
};

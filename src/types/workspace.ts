export interface Workspace {
  id: string;
  name: string;
  path: string;
  type: "local" | "imported" | "template";
  createdAt: number;
  lastModified: number;
}

export interface WorkspaceState {
  activeWorkspace: Workspace | null;
  recentWorkspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  files: { path: string; content: string }[];
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Empty Next.js project with Lingo.dev",
    files: [],
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Marketing landing page template",
    files: [],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Admin dashboard template",
    files: [],
  },
];

export function generateWorkspaceId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

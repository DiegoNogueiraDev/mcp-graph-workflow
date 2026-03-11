import { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  switchProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  activeProject: null,
  loading: true,
  switchProject: async () => {},
  refreshProjects: async () => {},
});

interface ProjectProviderProps {
  children: ReactNode;
  onProjectChange?: (() => void) | (() => Promise<void>);
}

export function ProjectProvider({ children, onProjectChange }: ProjectProviderProps): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const [projectList, active] = await Promise.all([
        apiClient.getProjects().catch(() => ({ total: 0, projects: [] })),
        apiClient.getActiveProject().catch(() => null),
      ]);
      setProjects(projectList.projects);
      setActiveProject(active);
    } catch {
      // Silently handle — project endpoints may not exist on older backends
    } finally {
      setLoading(false);
    }
  }, []);

  const switchProject = useCallback(async (id: string) => {
    try {
      const result = await apiClient.activateProject(id);
      if (result.project) {
        setActiveProject(result.project as Project);
        onProjectChange?.();
      }
    } catch {
      // Handle error silently — UI will remain on current project
    }
  }, [onProjectChange]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return (
    <ProjectContext.Provider value={{ projects, activeProject, loading, switchProject, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

import { useContext } from "react";
import { ProjectContext, type ProjectContextValue } from "@/providers/project-provider";

export function useProject(): ProjectContextValue {
  return useContext(ProjectContext);
}

// Navigation state: role, the screen stack, tabs and the toast. No routing library (stage 2 plan, task 7).
import { createContext, useContext } from "react";

export type Role = "coach" | "trainee" | null;
export interface Route { screen: string; params: Record<string, any> }

export interface Nav {
  role: Role;
  tab: string | null;
  depth: number;
  go: (screen: string, params?: Record<string, any>) => void;
  replace: (screen: string, params?: Record<string, any>) => void;
  back: () => void;
  setTab: (tab: string) => void;
  signIn: (role: "coach" | "trainee", traineeID?: string) => void;
  signOut: () => void;
  toast: (text: string) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav outside NavContext");
  return nav;
}

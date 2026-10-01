// Navigation state: role, the screen stack, tabs and the toast. No routing library (stage 2 plan, task 7).
import { createContext, useContext } from "react";

export type Role = "owner" | "coach" | "trainee" | null;
export type SignedRole = Exclude<Role, null>;
export interface Route { screen: string; params: Record<string, any> }

export interface Nav {
  role: Role;
  roles: SignedRole[]; // every role of the person (map v11); an owner who is also a coach moves between them (rule 10)
  tab: string | null;
  depth: number;
  go: (screen: string, params?: Record<string, any>) => void;
  replace: (screen: string, params?: Record<string, any>) => void;
  back: () => void;
  setTab: (tab: string) => void;
  signIn: (role: SignedRole, traineeID?: string, roles?: SignedRole[]) => void;
  switchRole: (role: SignedRole) => void; // between the person's roles, with no new sign-in
  signOut: () => void;
  toast: (text: string) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav outside NavContext");
  return nav;
}

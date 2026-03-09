import { createContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "central-admin" | "distributor" | "field-distributor";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  wardNo?: string;
  officeAddress?: string;
}

type StoredAuth = {
  user: AuthUser;
  token: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
};

const AUTH_STORAGE_KEY = "amar_ration_auth";
const ADMIN_EMAIL = "admin@amarration.gov.bd";
const ADMIN_PASSWORD = "Admin@123";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedAuth) return;

    try {
      const parsed: unknown = JSON.parse(storedAuth);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "user" in parsed &&
        "token" in parsed
      ) {
        const authData = parsed as StoredAuth;
        setUser(authData.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Failed to parse stored auth:", error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const login = async (
    email: string,
    password: string,
    role: UserRole
  ): Promise<boolean> => {
    try {
      if (!email || !password) return false;

      await new Promise((resolve) => setTimeout(resolve, 300));

      if (role === "central-admin") {
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
          return false;
        }

        const adminUser: AuthUser = {
          id: "admin-fixed-user",
          name: "Central Admin",
          email: ADMIN_EMAIL,
          role: "central-admin",
        };

        const adminToken = btoa(
          JSON.stringify({
            userId: adminUser.id,
            role: adminUser.role,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          })
        );

        const authData: StoredAuth = {
          user: adminUser,
          token: adminToken,
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        setUser(adminUser);
        setIsAuthenticated(true);
        return true;
      }

      const demoUser: AuthUser = {
        id: `user_${Date.now()}`,
        name: email.split("@")[0] || "User",
        email,
        role,
        wardNo: "ওয়ার্ড-০১",
        officeAddress: role === "distributor" ? "ঢাকা অফিস" : undefined,
      };

      const demoToken = btoa(
        JSON.stringify({
          userId: demoUser.id,
          role: demoUser.role,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        })
      );

      const authData: StoredAuth = {
        user: demoUser,
        token: demoToken,
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setUser(demoUser);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
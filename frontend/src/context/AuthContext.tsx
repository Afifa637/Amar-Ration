import { createContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "central-admin" | "distributor" | "field-distributor";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  wardNo?: string;
  officeAddress?: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
};

const AUTH_STORAGE_KEY = "amar_ration_auth";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const { user, token } = JSON.parse(storedAuth);
        // In production, validate token with backend
        if (user && token) {
          setUser(user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Failed to parse stored auth:", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  const login = async (
    email: string,
    password: string,
    role: UserRole
  ): Promise<boolean> => {
    try {
      // In production, this would be an API call to your backend
      // For demo purposes, we'll simulate authentication
      
      // Demo credentials validation (remove in production)
      if (!email || !password) {
        return false;
      }

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create demo user based on role
      const demoUser: User = {
        id: `user_${Date.now()}`,
        name: email.split("@")[0],
        email: email,
        role: role,
        wardNo: role !== "central-admin" ? "ওয়ার্ড-০১" : undefined,
        officeAddress: role === "distributor" ? "ঢাকা অফিস" : undefined,
      };

      // Generate demo token (in production, backend sends this)
      const demoToken = btoa(
        JSON.stringify({
          userId: demoUser.id,
          role: demoUser.role,
          exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        })
      );

      // Store in localStorage
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: demoUser, token: demoToken })
      );

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

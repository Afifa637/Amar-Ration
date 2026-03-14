import { createContext, useState, useEffect, type ReactNode } from "react";
import api, { AUTH_STORAGE_KEY } from "../services/api";

export type UserRole = "central-admin" | "distributor" | "field-distributor";

// Map backend userTypes to frontend roles
const userTypeToRole: Record<string, UserRole> = {
  Admin: "central-admin",
  Distributor: "distributor",
  FieldUser: "field-distributor",
};

// Map frontend roles to backend userTypes
const roleToUserType: Record<UserRole, string> = {
  "central-admin": "Admin",
  distributor: "Distributor",
  "field-distributor": "FieldUser",
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  wardNo?: string;
  officeAddress?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

      if (!storedAuth) return;

      try {
        const parsed = JSON.parse(storedAuth) as {
          user?: AuthUser;
          token?: string;
        };

        if (parsed?.user && parsed?.token) {
          api.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;

          if (active) {
            setUser(parsed.user);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error("Failed to parse stored auth:", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        delete api.defaults.headers.common.Authorization;
        if (active) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    void initializeAuth().finally(() => {
      if (active) setIsInitialized(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const login = async (
    email: string,
    password: string,
    role: UserRole,
  ): Promise<boolean> => {
    try {
      // Map frontend role to backend userType
      const userType = roleToUserType[role];

      // Call backend login API
      const response = await api.post("/auth/login", {
        identifier: email,
        password,
        userType,
      });

      if (response.data.success) {
        const { token, user: backendUser } = response.data.data;

        // Map backend user to frontend user format
        const frontendUser: AuthUser = {
          id: backendUser._id,
          name: backendUser.name,
          email: backendUser.email,
          role: userTypeToRole[backendUser.userType] || role,
          wardNo: backendUser.wardNo,
          officeAddress: backendUser.officeAddress,
        };

        // Store in localStorage
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ user: frontendUser, token }),
        );

        // Set token in api headers for subsequent requests
        api.defaults.headers.common.Authorization = `Bearer ${token}`;

        setUser(frontendUser);
        setIsAuthenticated(true);

        return true;
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      console.error("Login failed:", message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    delete api.defaults.headers.common.Authorization;
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
        isInitialized,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

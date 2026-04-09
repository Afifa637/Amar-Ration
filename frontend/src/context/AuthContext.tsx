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
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  userType?: "Admin" | "Distributor" | "FieldUser" | "Consumer";
  role: UserRole;
  wardNo?: string;
  ward?: string;
  unionName?: string;
  upazila?: string;
  district?: string;
  division?: string;
  officeAddress?: string;
  authorityStatus?: "Pending" | "Active" | "Suspended" | "Revoked";
  mustChangePassword?: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<{
    success: boolean;
    mustChangePassword?: boolean;
    reason?: "pending-approval" | "blocked" | "authority-expired";
    message?: string;
  }>;
  updateSession: (payload: {
    token?: string;
    userPatch?: Partial<AuthUser>;
  }) => void;
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
  ): Promise<{
    success: boolean;
    mustChangePassword?: boolean;
    reason?: "pending-approval" | "blocked" | "authority-expired";
    message?: string;
  }> => {
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
        const {
          token,
          user: backendUser,
          mustChangePassword,
        } = response.data.data;

        // Map backend user to frontend user format
        const frontendUser: AuthUser = {
          id: backendUser._id,
          _id: backendUser._id,
          name: backendUser.name,
          email: backendUser.email,
          phone: backendUser.phone,
          userType: backendUser.userType,
          role: userTypeToRole[backendUser.userType] || role,
          wardNo: backendUser.wardNo,
          ward: backendUser.ward,
          unionName: backendUser.unionName,
          upazila: backendUser.upazila,
          district: backendUser.district,
          division: backendUser.division,
          officeAddress: backendUser.officeAddress,
          authorityStatus: backendUser.authorityStatus,
          mustChangePassword: Boolean(mustChangePassword),
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

        return {
          success: true,
          mustChangePassword: Boolean(mustChangePassword),
        };
      }

      return { success: false };
    } catch (error: unknown) {
      const responseCode =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { data?: { code?: string } } })?.response
              ?.data?.code
          : undefined;
      if (responseCode === "PENDING_APPROVAL") {
        return { success: false, reason: "pending-approval" };
      }
      if (responseCode === "ACCESS_BLOCKED") {
        return { success: false, reason: "blocked" };
      }
      if (responseCode === "AUTHORITY_EXPIRED") {
        return { success: false, reason: "authority-expired" };
      }

      const statusCode =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { status?: number } })?.response?.status
          : undefined;

      const responseMessage =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { data?: { message?: string } } })?.response
              ?.data?.message
          : undefined;

      if (statusCode === 429) {
        return {
          success: false,
          message:
            responseMessage ||
            "অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।",
        };
      }

      const message = error instanceof Error ? error.message : "Login failed";
      console.error("Login failed:", message);
      return {
        success: false,
        message: responseMessage || "ইমেইল/পাসওয়ার্ড বা রোল সঠিক নয়",
      };
    }
  };

  const updateSession = ({
    token,
    userPatch,
  }: {
    token?: string;
    userPatch?: Partial<AuthUser>;
  }) => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    let parsedToken = "";

    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth) as {
          user?: AuthUser;
          token?: string;
        };
        parsedToken = parsed?.token || "";
      } catch {
        // ignore malformed storage
      }
    }

    const nextToken = token || parsedToken;
    const nextUser = user ? { ...user, ...(userPatch || {}) } : null;

    if (nextUser && nextToken) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: nextUser, token: nextToken }),
      );
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
    }

    if (nextUser) {
      setUser(nextUser);
      setIsAuthenticated(true);
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
        updateSession,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

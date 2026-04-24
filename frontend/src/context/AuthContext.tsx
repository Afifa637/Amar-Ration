import { createContext, useState, useEffect, type ReactNode } from "react";
import api, {
  AUTH_STORAGE_KEY,
  REFRESH_STORAGE_KEY,
  logoutSession,
} from "../services/api";

export type UserRole = "central-admin" | "distributor";

// Map backend userTypes to frontend roles
const userTypeToRole: Record<string, UserRole> = {
  Admin: "central-admin",
  Distributor: "distributor",
  FieldUser: "distributor",
};

// Map frontend roles to backend userTypes
const roleToUserType: Record<UserRole, string> = {
  "central-admin": "Admin",
  distributor: "Distributor",
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
  twoFactorMismatch?: boolean;
  twoFactorMismatchWarning?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (
    email: string,
    password: string,
    role: UserRole,
    options?: { totpToken?: string },
  ) => Promise<{
    success: boolean;
    requires2FA?: boolean;
    mustChangePassword?: boolean;
    loggedInRole?: UserRole;
    reason?: "pending-approval" | "blocked" | "authority-expired";
    message?: string;
  }>;
  updateSession: (payload: {
    token?: string;
    refreshToken?: string;
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
        sessionStorage.removeItem(REFRESH_STORAGE_KEY);
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
    options?: { totpToken?: string },
  ): Promise<{
    success: boolean;
    requires2FA?: boolean;
    mustChangePassword?: boolean;
    loggedInRole?: UserRole;
    reason?: "pending-approval" | "blocked" | "authority-expired";
    message?: string;
  }> => {
    const loginUserTypes =
      role === "distributor"
        ? ["Distributor", "Admin"]
        : [roleToUserType[role]];
    let authFailedAcrossPortals = false;

    for (const portalUserType of loginUserTypes) {
      try {
        const response = await api.post("/auth/login", {
          identifier: email,
          password,
          userType: portalUserType,
          totpToken: options?.totpToken,
        });

        if (response.data?.requires2FA) {
          return {
            success: false,
            requires2FA: true,
            message: response.data?.message || "2FA code required",
          };
        }

        if (response.data.success) {
          const {
            token,
            refreshToken,
            user: backendUser,
            mustChangePassword,
            twoFactorMismatch,
            twoFactorMismatchWarning,
          } = response.data.data;

          const frontendUser: AuthUser = {
            id: backendUser._id,
            _id: backendUser._id,
            name: backendUser.name,
            email: backendUser.email,
            phone: backendUser.phone,
            userType: backendUser.userType,
            role: userTypeToRole[backendUser.userType] || "distributor",
            wardNo: backendUser.wardNo,
            ward: backendUser.ward,
            unionName: backendUser.unionName,
            upazila: backendUser.upazila,
            district: backendUser.district,
            division: backendUser.division,
            officeAddress: backendUser.officeAddress,
            authorityStatus: backendUser.authorityStatus,
            mustChangePassword: Boolean(mustChangePassword),
            twoFactorMismatch: Boolean(twoFactorMismatch),
            twoFactorMismatchWarning:
              typeof twoFactorMismatchWarning === "string"
                ? twoFactorMismatchWarning
                : undefined,
          };

          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({ user: frontendUser, token }),
          );
          if (refreshToken) {
            sessionStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
          } else {
            sessionStorage.removeItem(REFRESH_STORAGE_KEY);
          }

          api.defaults.headers.common.Authorization = `Bearer ${token}`;

          setUser(frontendUser);
          setIsAuthenticated(true);

          return {
            success: true,
            mustChangePassword: Boolean(mustChangePassword),
            loggedInRole: frontendUser.role,
          };
        }
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error && "response" in error
            ? (error as { response?: { status?: number } })?.response?.status
            : undefined;

        if (statusCode === 401) {
          authFailedAcrossPortals = true;
          continue;
        }

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

        const responseMessage =
          typeof error === "object" && error && "response" in error
            ? (error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message
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
    }

    if (authFailedAcrossPortals) {
      return {
        success: false,
        message: "ইমেইল/পাসওয়ার্ড সঠিক নয়",
      };
    }

    return { success: false, message: "লগইন ব্যর্থ হয়েছে" };
  };

  const updateSession = ({
    token,
    refreshToken,
    userPatch,
  }: {
    token?: string;
    refreshToken?: string;
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
      if (refreshToken !== undefined) {
        if (refreshToken) {
          sessionStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
        } else {
          sessionStorage.removeItem(REFRESH_STORAGE_KEY);
        }
      }
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
    }

    if (nextUser) {
      setUser(nextUser);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    const refreshToken = sessionStorage.getItem(REFRESH_STORAGE_KEY) || "";

    void logoutSession(refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
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

import { useContext} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext, type UserRole } from "../context/AuthContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const auth = useContext(AuthContext);
  const location = useLocation();

  console.log("ProtectedRoute user:", auth?.user);
console.log("Allowed roles:", allowedRoles);

  // If not authenticated, redirect to entrance page
  if (!auth?.isAuthenticated || !auth.user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If allowedRoles is specified, check if user has required role
  if (allowedRoles && !auth.hasRole(allowedRoles)) {
    // Redirect to unauthorized page or entrance
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            অ্যাক্সেস নিষিদ্ধ
          </h2>
          <p className="text-gray-600 mb-4">
            আপনার এই পেজ অ্যাক্সেস করার অনুমতি নেই।
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-[#16679c] text-white px-6 py-2 rounded-lg hover:bg-[#125a85] transition-colors"
          >
            ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

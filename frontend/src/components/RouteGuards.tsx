import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const { account, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function RequireStaff() {
  const { account, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  if (account.role !== "staff") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-gray-700">This area is only available to IT staff.</p>
      </div>
    );
  }
  return <Outlet />;
}

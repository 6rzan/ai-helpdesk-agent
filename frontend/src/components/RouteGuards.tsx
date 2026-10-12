import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PASSWORD_CHANGE_PATH = "/settings";

export function RequireAuth() {
  const { account, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  if (account.usingInitialPassword && location.pathname !== PASSWORD_CHANGE_PATH) {
    return <Navigate to={PASSWORD_CHANGE_PATH} replace />;
  }
  return <Outlet />;
}

export function RequireStaff() {
  const { account, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  if (account.usingInitialPassword && location.pathname !== PASSWORD_CHANGE_PATH) {
    return <Navigate to={PASSWORD_CHANGE_PATH} replace />;
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

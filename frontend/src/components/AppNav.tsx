import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateAvailability } from "../services/api";
import type { AvailabilityStatus } from "../lib/types";

export function AppNav() {
  const { account, logout, refresh } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleAvailabilityChange(availability: AvailabilityStatus) {
    await updateAvailability(availability);
    await refresh();
  }

  return (
    <nav className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
      <Link to="/" className="text-base font-semibold">
        IT Help Desk
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {account ? (
          <>
            {account.role === "staff" && (
              <>
                <Link to="/staff" className="text-blue-600 hover:underline">
                  Dashboard
                </Link>
                <label className="flex items-center gap-1.5 text-gray-600">
                  <span className="sr-only">Availability</span>
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 rounded-full ${
                      account.availability === "available" ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                  <select
                    aria-label="Availability"
                    value={account.availability ?? "available"}
                    onChange={(e) => handleAvailabilityChange(e.target.value as AvailabilityStatus)}
                    className="rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-700"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="away">Away</option>
                  </select>
                </label>
              </>
            )}
            <Link to="/profile" className="text-blue-600 hover:underline">
              {account.displayName}
            </Link>
            <Link to="/tickets" className="text-blue-600 hover:underline">My tickets</Link>
            <Link to="/settings" className="text-blue-600 hover:underline">Settings</Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

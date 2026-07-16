import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { RequireAuth, RequireStaff } from "./components/RouteGuards";
import { AuthProvider } from "./context/AuthContext";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { MyTicketDetailPage, MyTicketsPage } from "./pages/MyTicketsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UserProfilePage } from "./pages/staff/UserProfilePage";
import { ImportPage } from "./pages/staff/ImportPage";

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<ChatPage />} />
              <Route path="/tickets" element={<MyTicketsPage />} />
              <Route path="/tickets/:reference" element={<MyTicketDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<RequireStaff />}>
              <Route path="/staff" element={<DashboardPage />} />
              <Route path="/staff/tickets/:reference" element={<TicketDetailPage />} />
              <Route path="/staff/users/:accountId/profile" element={<UserProfilePage />} />
              <Route path="/staff/import" element={<ImportPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

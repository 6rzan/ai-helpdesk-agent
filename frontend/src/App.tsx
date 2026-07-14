import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { RequireAuth, RequireStaff } from "./components/RouteGuards";
import { AuthProvider } from "./context/AuthContext";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";

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
            </Route>
            <Route element={<RequireStaff />}>
              <Route path="/staff" element={<DashboardPage />} />
              <Route path="/staff/tickets/:reference" element={<TicketDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

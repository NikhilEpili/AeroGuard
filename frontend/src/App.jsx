import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Loader from "./components/common/Loader";

const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const readStoredUser = () => {
  const raw = localStorage.getItem("aeroguard_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("aeroguard_user");
    return null;
  }
};

const ProtectedRoute = ({ children }) => {
  const user = readStoredUser();
  return user ? children : <Navigate to="/onboarding" replace />;
};

const PublicRoute = ({ children }) => {
  const user = readStoredUser();
  return !user ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<Loader label="Loading page..." />}>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <PublicRoute>
                <Onboarding />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
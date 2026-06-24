import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ApplicantDashboard from "./pages/applicant/Dashboard";
import ApplicationForm from "./pages/applicant/ApplicationForm";
import ApplicantApplicationDetail from "./pages/applicant/ApplicationDetail";
import ReviewerQueue from "./pages/reviewer/Queue";
import ReviewerApplicationDetail from "./pages/reviewer/ApplicationDetail";

function RequireAuth({ role, children }: { role?: "APPLICANT" | "REVIEWER"; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "REVIEWER" ? "/reviewer" : "/"} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Applicant routes */}
      <Route path="/" element={
        <RequireAuth role="APPLICANT">
          <Layout><ApplicantDashboard /></Layout>
        </RequireAuth>
      } />
      <Route path="/applications/new" element={
        <RequireAuth role="APPLICANT">
          <Layout><ApplicationForm /></Layout>
        </RequireAuth>
      } />
      <Route path="/applications/:id" element={
        <RequireAuth role="APPLICANT">
          <Layout><ApplicantApplicationDetail /></Layout>
        </RequireAuth>
      } />
      <Route path="/applications/:id/edit" element={
        <RequireAuth role="APPLICANT">
          <Layout><ApplicationForm /></Layout>
        </RequireAuth>
      } />

      {/* Reviewer routes */}
      <Route path="/reviewer" element={
        <RequireAuth role="REVIEWER">
          <Layout><ReviewerQueue /></Layout>
        </RequireAuth>
      } />
      <Route path="/reviewer/applications/:id" element={
        <RequireAuth role="REVIEWER">
          <Layout><ReviewerApplicationDetail /></Layout>
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

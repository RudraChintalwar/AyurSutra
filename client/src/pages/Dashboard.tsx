import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";

/** Preserves query string (e.g. calendar_linked) when routing to role home. */
const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.toString();
  const suffix = q ? `?${q}` : "";

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "doctor") {
    return <Navigate to={`/doctor-dashboard${suffix}`} replace />;
  }

  return <Navigate to={`/patient-dashboard${suffix}`} replace />;
};

export default Dashboard;

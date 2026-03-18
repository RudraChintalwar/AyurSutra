import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

// Generic dashboard redirect based on user role
const Dashboard = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "doctor") {
    return <Navigate to="/doctor-dashboard" replace />;
  }

  return <Navigate to="/patient-dashboard" replace />;
};

export default Dashboard;
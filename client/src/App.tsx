import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import DoctorDashboard from "@/pages/DoctorDashboard";
import PatientDashboard from "@/pages/PatientDashboard";
import DoctorDiscoveryView from "@/pages/DoctorDiscoveryView";
import DoctorPatients from "@/pages/DoctorPatients";
import DoctorCalendar from "@/pages/DoctorCalendar";
import DoctorAnalytics from "@/pages/DoctorAnalytics";
import DoctorSettings from "@/pages/DoctorSettings";
import PatientSessions from "@/pages/PatientSessions";
import PatientRecords from "@/pages/PatientRecords";
import PatientSettings from "@/pages/PatientSettings";
import Messages from "@/pages/Messages";
import Progress from "@/pages/Progress";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import DietPlanner from "@/pages/DietPlanner";
import PulseMonitor from "@/pages/PulseMonitor";
import HerbalRemedies from "@/pages/HerbalRemedies";
import ReportAnalyzer from "@/pages/ReportAnalyzer";
import MedicineVerifier from "@/pages/MedicineVerifier";
import EmartHome from "@/pages/emart/EmartHome";
import EmartProducts from "@/pages/emart/EmartProducts";
import EmartProductDetail from "@/pages/emart/EmartProductDetail";
import EmartCart from "@/pages/emart/EmartCart";
import EmartCheckout from "@/pages/emart/EmartCheckout";
import EmartOrders from "@/pages/emart/EmartOrders";
import EmartAdminDashboard from "@/pages/emart/EmartAdminDashboard";
import EmartAdminOrderDetail from "@/pages/emart/EmartAdminOrderDetail";
import ChatbotWidget from "@/components/common/ChatbotWidget";

const queryClient = new QueryClient();

// ─── Protected Route ────────────────────────────────────
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ("patient" | "doctor" | "admin")[];
}) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-inter">{t("layout.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no role, route to login instead of assuming patient.
  if (!user.role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    // Redirect to correct dashboard
    return (
      <Navigate
        to={user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard"}
        replace
      />
    );
  }

  return <>{children}</>;
}

// ─── App ─────────────────────────────────────────────────
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/emart" element={<EmartHome />} />
      <Route path="/emart/products" element={<EmartProducts />} />
      <Route path="/emart/products/:productId" element={<EmartProductDetail />} />
      <Route path="/emart/cart" element={<EmartCart />} />
      <Route path="/emart/checkout" element={<EmartCheckout />} />
      <Route path="/emart/orders" element={<EmartOrders />} />
      <Route
        path="/emart/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <EmartAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emart/admin/orders/:orderId"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <EmartAdminOrderDetail />
          </ProtectedRoute>
        }
      />

      {/* Doctor Routes */}
      <Route
        path="/doctor-dashboard"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <DoctorDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/patients"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <DoctorPatients />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/calendar"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <DoctorCalendar />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/messages"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <Messages />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/analytics"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <DoctorAnalytics />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/settings"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DashboardLayout>
              <DoctorSettings />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Patient Routes */}
      <Route
        path="/patient-dashboard"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <PatientDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/sessions"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <PatientSessions />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/discovery"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <DoctorDiscoveryView />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/messages"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <Messages />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/progress"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <Progress />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/records"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <PatientRecords />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/settings"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <DashboardLayout>
              <PatientSettings />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/diet-plan"
        element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <DashboardLayout>
              <DietPlanner />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pulse-monitor"
        element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <DashboardLayout>
              <PulseMonitor />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/remedies"
        element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <DashboardLayout>
              <HerbalRemedies />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/report-analyzer"
        element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <DashboardLayout>
              <ReportAnalyzer />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/medicine-verifier"
        element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <DashboardLayout>
              <MedicineVerifier />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Legacy / shared routes */}
      {/* Redirect helper — no ProtectedRoute to avoid redirect loop */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
              <ChatbotWidget />
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

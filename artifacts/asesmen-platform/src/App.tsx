import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const Assessments = lazy(() => import("@/pages/assessments"));
const AssessmentCategories = lazy(
  () => import("@/pages/assessment-categories"),
);
const OnsiteAssessments = lazy(() =>
  import("@/pages/assessment-categories").then((module) => ({
    default: module.OnsiteAssessments,
  })),
);
const LegacyPsychologyToolsRedirect = lazy(
  () => import("@/pages/legacy-psychology-tools-redirect"),
);
const Cart = lazy(() => import("@/pages/cart"));
const Checkout = lazy(() => import("@/pages/checkout"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const AssessmentDetail = lazy(() => import("@/pages/assessment/[id]"));
const SensoryProfile = lazy(() => import("@/pages/sensory-profile"));
const LearningStyle = lazy(() => import("@/pages/learning-style"));
const MultipleIntelligence = lazy(
  () => import("@/pages/multiple-intelligence"),
);
const MentalHealthCheckup = lazy(() => import("@/pages/mental-health-checkup"));
const StudentPotentialTest = lazy(
  () => import("@/pages/student-potential-test"),
);
const CareerPotentialTest = lazy(() => import("@/pages/career-potential-test"));
const DassScreening = lazy(() => import("@/pages/dass-screening"));
const SrqScreening = lazy(() => import("@/pages/srq-screening"));
const AssessmentResults = lazy(() => import("@/pages/assessment-results"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminAssessments = lazy(() => import("@/pages/admin-assessments"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminAssessmentResult = lazy(
  () => import("@/pages/admin-assessment-result"),
);
const AdminExternalAssessments = lazy(
  () => import("@/pages/admin-external-assessments"),
);
const AdminDigitalProducts = lazy(
  () => import("@/pages/admin-digital-products"),
);
const AdminPhysicalProducts = lazy(
  () => import("@/pages/admin-physical-products"),
);
const AdminCourses = lazy(() => import("@/pages/admin-courses"));
const AdminArticles = lazy(() => import("@/pages/admin-articles"));
const AdminTrainings = lazy(() => import("@/pages/admin-trainings"));
const AdminBookingPromos = lazy(() => import("@/pages/admin-booking-promos"));
const AdminHospitality = lazy(() => import("@/pages/admin-hospitality"));
const AdminTherapies = lazy(() => import("@/pages/admin-therapies"));
const AdminOnsiteAssessments = lazy(
  () => import("@/pages/admin-onsite-assessments"),
);
const AdminPsychologyTestTools = lazy(
  () => import("@/pages/admin-psychology-test-tools"),
);
const AdminWebsiteAnalytics = lazy(
  () => import("@/pages/admin-website-analytics"),
);
const DigitalProductCheckout = lazy(
  () => import("@/pages/digital-product-checkout"),
);
const PhysicalProductCheckout = lazy(
  () => import("@/pages/physical-product-checkout"),
);
const TrainingRegistration = lazy(
  () => import("@/pages/training-registration"),
);
const PaymentReturn = lazy(() => import("@/pages/payment-return"));
const Kontak = lazy(() => import("@/pages/kontak"));
const Booking = lazy(() => import("@/pages/booking"));
const PsychologistDashboard = lazy(
  () => import("@/pages/psychologist-dashboard"),
);
const AdminPsychologistBookings = lazy(() =>
  import("@/pages/psychologist-dashboard").then((module) => ({
    default: module.AdminPsychologistBookings,
  })),
);
const Layanan = lazy(() => import("@/pages/layanan"));
const LayananDetail = lazy(() => import("@/pages/layanan-detail"));
const Artikel = lazy(() => import("@/pages/artikel"));
const ArtikelDetail = lazy(() => import("@/pages/artikel-detail"));
const TimDetail = lazy(() => import("@/pages/tim-detail"));
import WhatsAppBranchChooser from "@/components/WhatsAppBranchChooser";
import WebsiteAnalytics from "@/components/WebsiteAnalytics";
import { useIdleLogout } from "@/hooks/useIdleLogout";

const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          role="status"
          aria-live="polite"
        >
          Memuat halaman...
        </div>
      }
    >
      <Switch>
        {/* Home route - different component based on auth status */}
        <Route
          path="/"
          component={isLoading || !isAuthenticated ? Landing : Home}
        />

        {/* Public routes - always available */}
        <Route path="/assessments/online" component={Assessments} />
        <Route path="/assessments/onsite" component={OnsiteAssessments} />
        <Route
          path="/assessments/alat-tes"
          component={LegacyPsychologyToolsRedirect}
        />
        <Route path="/assessments" component={AssessmentCategories} />
        <Route path="/layanan" component={Layanan} />
        <Route path="/layanan/:slug" component={LayananDetail} />
        <Route path="/artikel" component={Artikel} />
        <Route path="/artikel/:slug" component={ArtikelDetail} />
        <Route path="/tim/:id" component={TimDetail} />
        <Route path="/kontak" component={Kontak} />
        <Route path="/booking" component={Booking} />
        <Route path="/booking/form" component={Booking} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />

        {/* Protected routes - always defined but will redirect if not authenticated */}
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/dashboard" component={Dashboard} />
        <Route
          path="/digital-products/checkout"
          component={DigitalProductCheckout}
        />
        <Route
          path="/physical-products/checkout"
          component={PhysicalProductCheckout}
        />
        <Route path="/training/register" component={TrainingRegistration} />
        <Route
          path="/psychologist/dashboard"
          component={() => <PsychologistDashboard />}
        />
        <Route path="/assessment/:id" component={AssessmentDetail} />
        <Route
          path="/sensory-profile/:assessmentId"
          component={SensoryProfile}
        />
        <Route path="/learning-style/:assessmentId" component={LearningStyle} />
        <Route
          path="/multiple-intelligence/:userAssessmentId"
          component={MultipleIntelligence}
        />
        <Route
          path="/mental-health-checkup/:userAssessmentId"
          component={MentalHealthCheckup}
        />
        <Route
          path="/student-potential-test/:userAssessmentId"
          component={StudentPotentialTest}
        />
        <Route
          path="/career-potential-test/:userAssessmentId"
          component={CareerPotentialTest}
        />
        <Route path="/dass-screening/:orderId" component={DassScreening} />
        <Route path="/srq-screening/:orderId" component={SrqScreening} />
        <Route path="/results/:assessmentId" component={AssessmentResults} />
        <Route path="/payment-success" component={PaymentReturn} />
        <Route path="/payment-failed" component={PaymentReturn} />
        <Route path="/payment-return" component={PaymentReturn} />
        <Route path="/payment-success-redirect" component={PaymentReturn} />

        {/* Admin routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route
          path="/admin/dashboard"
          component={() => <AdminDashboard mode="admin" />}
        />
        <Route path="/admin/bookings" component={AdminPsychologistBookings} />
        <Route
          path="/cso/dashboard"
          component={() => <AdminDashboard mode="cso" />}
        />
        <Route path="/cso/bookings" component={AdminPsychologistBookings} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/assessments" component={AdminAssessments} />
        <Route path="/admin/reports" component={AdminReports} />
        <Route
          path="/admin/assessment-result/:userAssessmentId"
          component={AdminAssessmentResult}
        />
        <Route
          path="/admin/external-assessments"
          component={AdminExternalAssessments}
        />
        <Route
          path="/cso/external-assessments"
          component={AdminExternalAssessments}
        />
        <Route path="/admin/video-e-learning">
          <AdminDigitalProducts key="elearning" elearning />
        </Route>
        <Route path="/admin/digital-products">
          <AdminDigitalProducts key="digital" />
        </Route>
        <Route
          path="/admin/physical-products"
          component={AdminPhysicalProducts}
        />
        <Route path="/admin/courses" component={AdminCourses} />
        <Route path="/admin/articles" component={AdminArticles} />
        <Route path="/admin/booking-promos" component={AdminBookingPromos} />
        <Route path="/admin/hospitality" component={AdminHospitality} />
        <Route path="/admin/therapies" component={AdminTherapies} />
        <Route
          path="/admin/onsite-assessments"
          component={AdminOnsiteAssessments}
        />
        <Route
          path="/admin/psychology-test-tools"
          component={AdminPsychologyTestTools}
        />
        <Route
          path="/admin/website-analytics"
          component={AdminWebsiteAnalytics}
        />
        <Route path="/admin/therapy-gallery" component={AdminTherapies} />
        <Route path="/admin/trainings" component={AdminTrainings} />

        {/* 404 fallback */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useIdleLogout();

  const routerBase = window.location.pathname.startsWith(
    import.meta.env.BASE_URL,
  )
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : "";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={routerBase}>
          <WebsiteAnalytics />
          <Router />
          <WhatsAppBranchChooser variant="floating" />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

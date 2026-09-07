import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Assessments from "@/pages/assessments";
import AssessmentCategories, { OnsiteAssessments } from "@/pages/assessment-categories";
import LegacyPsychologyToolsRedirect from "@/pages/legacy-psychology-tools-redirect";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Dashboard from "@/pages/dashboard";
import AssessmentDetail from "@/pages/assessment/[id]";
import SensoryProfile from "@/pages/sensory-profile";
import LearningStyle from "@/pages/learning-style";
import MultipleIntelligence from "@/pages/multiple-intelligence";
import MentalHealthCheckup from "@/pages/mental-health-checkup";
import StudentPotentialTest from "@/pages/student-potential-test";
import CareerPotentialTest from "@/pages/career-potential-test";
import DassScreening from "@/pages/dass-screening";
import SrqScreening from "@/pages/srq-screening";
import AssessmentResults from "@/pages/assessment-results";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import AdminAssessments from "@/pages/admin-assessments";
import AdminReports from "@/pages/admin-reports";
import AdminAssessmentResult from "@/pages/admin-assessment-result";
import AdminExternalAssessments from "@/pages/admin-external-assessments";
import AdminDigitalProducts from "@/pages/admin-digital-products";
import AdminPhysicalProducts from "@/pages/admin-physical-products";
import AdminCourses from "@/pages/admin-courses";
import AdminArticles from "@/pages/admin-articles";
import AdminTrainings from "@/pages/admin-trainings";
import AdminBookingPromos from "@/pages/admin-booking-promos";
import AdminHospitality from "@/pages/admin-hospitality";
import AdminTherapies from "@/pages/admin-therapies";
import AdminOnsiteAssessments from "@/pages/admin-onsite-assessments";
import AdminPsychologyTestTools from "@/pages/admin-psychology-test-tools";
import AdminWebsiteAnalytics from "@/pages/admin-website-analytics";
import DigitalProductCheckout from "@/pages/digital-product-checkout";
import PhysicalProductCheckout from "@/pages/physical-product-checkout";
import TrainingRegistration from "@/pages/training-registration";
import PaymentSuccess from "@/pages/payment-success";
import PaymentFailed from "@/pages/payment-failed";
import PaymentReturn from "@/pages/payment-return";
import AutoRedirect from "@/pages/auto-redirect";
import Kontak from "@/pages/kontak";
import Booking from "@/pages/booking";
import PsychologistDashboard, { AdminPsychologistBookings } from "@/pages/psychologist-dashboard";
import Layanan from "@/pages/layanan";
import LayananDetail from "@/pages/layanan-detail";
import Artikel from "@/pages/artikel";
import ArtikelDetail from "@/pages/artikel-detail";
import TimDetail from "@/pages/tim-detail";
import WhatsAppBranchChooser from "@/components/WhatsAppBranchChooser";
import WebsiteAnalytics from "@/components/WebsiteAnalytics";
import { useIdleLogout } from "@/hooks/useIdleLogout";

import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Home route - different component based on auth status */}
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      
      {/* Public routes - always available */}
      <Route path="/assessments/online" component={Assessments} />
      <Route path="/assessments/onsite" component={OnsiteAssessments} />
      <Route path="/assessments/alat-tes" component={LegacyPsychologyToolsRedirect} />
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
      <Route path="/digital-products/checkout" component={DigitalProductCheckout} />
      <Route path="/physical-products/checkout" component={PhysicalProductCheckout} />
      <Route path="/training/register" component={TrainingRegistration} />
      <Route path="/psychologist/dashboard" component={PsychologistDashboard} />
      <Route path="/assessment/:id" component={AssessmentDetail} />
      <Route path="/sensory-profile/:assessmentId" component={SensoryProfile} />
      <Route path="/learning-style/:assessmentId" component={LearningStyle} />
      <Route path="/multiple-intelligence/:userAssessmentId" component={MultipleIntelligence} />
      <Route path="/mental-health-checkup/:userAssessmentId" component={MentalHealthCheckup} />
      <Route path="/student-potential-test/:userAssessmentId" component={StudentPotentialTest} />
      <Route path="/career-potential-test/:userAssessmentId" component={CareerPotentialTest} />
      <Route path="/dass-screening/:orderId" component={DassScreening} />
      <Route path="/srq-screening/:orderId" component={SrqScreening} />
      <Route path="/results/:assessmentId" component={AssessmentResults} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-failed" component={PaymentFailed} />
      <Route path="/payment-return" component={PaymentReturn} />
      <Route path="/payment-success-redirect" component={AutoRedirect} />
      
      {/* Admin routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/bookings" component={AdminPsychologistBookings} />
      <Route path="/cso/dashboard" component={() => <AdminDashboard mode="cso" />} />
      <Route path="/cso/bookings" component={AdminPsychologistBookings} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/assessments" component={AdminAssessments} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/assessment-result/:userAssessmentId" component={AdminAssessmentResult} />
      <Route path="/admin/external-assessments" component={AdminExternalAssessments} />
      <Route path="/cso/external-assessments" component={AdminExternalAssessments} />
      <Route path="/admin/digital-products" component={AdminDigitalProducts} />
      <Route path="/admin/physical-products" component={AdminPhysicalProducts} />
      <Route path="/admin/courses" component={AdminCourses} />
      <Route path="/admin/articles" component={AdminArticles} />
      <Route path="/admin/booking-promos" component={AdminBookingPromos} />
      <Route path="/admin/hospitality" component={AdminHospitality} />
      <Route path="/admin/therapies" component={AdminTherapies} />
      <Route path="/admin/onsite-assessments" component={AdminOnsiteAssessments} />
      <Route path="/admin/psychology-test-tools" component={AdminPsychologyTestTools} />
      <Route path="/admin/website-analytics" component={AdminWebsiteAnalytics} />
      <Route path="/admin/therapy-gallery" component={AdminTherapies} />
      <Route path="/admin/trainings" component={AdminTrainings} />
      
      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useIdleLogout();

  const routerBase = window.location.pathname.startsWith(import.meta.env.BASE_URL)
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

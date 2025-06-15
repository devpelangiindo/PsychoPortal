import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Assessments from "@/pages/assessments";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Dashboard from "@/pages/dashboard";
import AssessmentDetail from "@/pages/assessment/[id]";
import SensoryProfile from "@/pages/sensory-profile";
import LearningStyle from "@/pages/learning-style";
import AssessmentResults from "@/pages/assessment-results";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Home route - different component based on auth status */}
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      
      {/* Public routes - always available */}
      <Route path="/assessments" component={Assessments} />
      
      {/* Protected routes - always defined but will redirect if not authenticated */}
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/assessment/:id" component={AssessmentDetail} />
      <Route path="/sensory-profile/:assessmentId" component={SensoryProfile} />
      <Route path="/learning-style/:assessmentId" component={LearningStyle} />
      <Route path="/results/:assessmentId" component={AssessmentResults} />
      
      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

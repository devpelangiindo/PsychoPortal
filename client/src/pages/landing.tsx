import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Brain, GraduationCap, Clock, Users, Shield, Lock, IdCard } from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import AssessmentCard from "@/components/assessment-card";
import type { Assessment } from "@shared/schema";

export default function Landing() {
  const { data: assessments, isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  const handleGetStarted = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="gradient-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 dark:text-foreground mb-6">
              Professional Psychological <span className="text-primary">Assessment</span> Platform
            </h1>
            <p className="text-xl text-neutral-500 dark:text-muted-foreground mb-8 max-w-3xl mx-auto">
              Access scientifically validated psychological assessments including Sensory Profile and Learning Style Inventory. Pay-per-test model with secure payment processing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="px-8 py-4 text-lg font-semibold"
                onClick={handleGetStarted}
              >
                Browse Assessments
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-4 text-lg font-semibold border-2"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Assessments */}
      <section id="assessments" className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Available Assessments
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground max-w-2xl mx-auto">
              Choose from our professionally validated psychological assessment tools
            </p>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {[1, 2].map((i) => (
                <Card key={i} className="assessment-card-hover">
                  <div className="h-48 bg-muted animate-pulse" />
                  <CardContent className="p-8">
                    <div className="h-6 bg-muted rounded mb-4 animate-pulse" />
                    <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded mb-6 animate-pulse" />
                    <div className="flex justify-between items-center">
                      <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                      <div className="h-10 w-32 bg-muted rounded animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {assessments?.map((assessment) => (
                <AssessmentCard key={assessment.id} assessment={assessment} showAddToCart={false} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-neutral-50 dark:bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground">
              Simple, secure, and professional assessment process
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                1. Select Assessment
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Choose from our validated psychological assessment tools
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-secondary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                2. Secure Payment
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Pay securely using Xendit payment gateway
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-accent/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                3. Take Assessment
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Complete the assessment at your own pace
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <IdCard className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-3">
                4. Get Results
              </h3>
              <p className="text-neutral-500 dark:text-muted-foreground">
                Receive detailed professional reports and insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-foreground mb-4">
              Trusted by Professionals
            </h2>
            <p className="text-lg text-neutral-500 dark:text-muted-foreground">
              Join thousands of psychology professionals worldwide
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10,000+</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Assessments Completed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">500+</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Professional Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-neutral-500 dark:text-muted-foreground">Uptime Reliability</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="trust-indicator">
              <Shield className="w-5 h-5" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="trust-indicator">
              <Lock className="w-5 h-5" />
              <span>SSL Encrypted</span>
            </div>
            <div className="trust-indicator">
              <IdCard className="w-5 h-5" />
              <span>Scientifically Validated</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

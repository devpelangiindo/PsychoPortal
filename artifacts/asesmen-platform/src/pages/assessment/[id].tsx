import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import type { UserAssessmentWithDetails } from "@shared/schema";
import { formatDisplayDate } from "@/lib/date-format";

export default function AssessmentDetail() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/assessment/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  const assessmentId = params?.id ? parseInt(params.id) : null;

  const { data: userAssessment, isLoading, error } = useQuery<UserAssessmentWithDetails>({
    queryKey: [`/api/user-assessments/${assessmentId}`],
    enabled: !!assessmentId && isAuthenticated,
  });

  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/start`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/${assessmentId}`] });
      toast({
        title: "Asesmen Dimulai",
        description: "Anda sekarang dapat mulai mengikuti asesmen.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to start assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeAssessmentMutation = useMutation({
    mutationFn: async (results: any) => {
      if (!userAssessment) throw new Error("No assessment found");
      const response = await apiRequest("POST", `/api/user-assessments/${userAssessment.id}/complete`, { results });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user-assessments/${assessmentId}`] });
      toast({
        title: "Asesmen Selesai!",
        description: "Hasil Anda telah disimpan dan sedang diproses.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to complete assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  // Mock assessment questions based on type
  const getAssessmentQuestions = (type: string) => {
    if (type === 'sensory') {
      return [
        {
          id: 1,
          question: "How do you typically respond to loud noises?",
          type: "scale",
          options: [
            { value: 1, label: "Very uncomfortable" },
            { value: 2, label: "Somewhat uncomfortable" },
            { value: 3, label: "Neutral" },
            { value: 4, label: "Comfortable" },
            { value: 5, label: "Very comfortable" }
          ]
        },
        {
          id: 2,
          question: "How do you react to different textures of clothing?",
          type: "scale",
          options: [
            { value: 1, label: "Very sensitive" },
            { value: 2, label: "Somewhat sensitive" },
            { value: 3, label: "Neutral" },
            { value: 4, label: "Not sensitive" },
            { value: 5, label: "Not sensitive at all" }
          ]
        },
        {
          id: 3,
          question: "How do you respond to bright lights?",
          type: "scale",
          options: [
            { value: 1, label: "Very bothered" },
            { value: 2, label: "Somewhat bothered" },
            { value: 3, label: "Neutral" },
            { value: 4, label: "Not bothered" },
            { value: 5, label: "Not bothered at all" }
          ]
        }
      ];
    } else {
      return [
        {
          id: 1,
          question: "When learning new information, I prefer to:",
          type: "multiple",
          options: [
            { value: "visual", label: "See diagrams, charts, or visual aids" },
            { value: "auditory", label: "Hear explanations or discussions" },
            { value: "kinesthetic", label: "Practice hands-on activities" },
            { value: "reading", label: "Read detailed written materials" }
          ]
        },
        {
          id: 2,
          question: "In a classroom setting, I learn best when:",
          type: "multiple",
          options: [
            { value: "visual", label: "The teacher uses visual presentations" },
            { value: "auditory", label: "There are group discussions" },
            { value: "kinesthetic", label: "I can move around and be active" },
            { value: "reading", label: "I can take detailed notes" }
          ]
        },
        {
          id: 3,
          question: "When I need to remember something, I:",
          type: "multiple",
          options: [
            { value: "visual", label: "Create mental pictures or diagrams" },
            { value: "auditory", label: "Repeat it out loud or hear it" },
            { value: "kinesthetic", label: "Write it down or practice it" },
            { value: "reading", label: "Make lists or written summaries" }
          ]
        }
      ];
    }
  };

  const handleStartAssessment = () => {
    startAssessmentMutation.mutate();
  };

  const handleResponseChange = (questionId: number, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNextStep = () => {
    if (!userAssessment) return;
    const questions = getAssessmentQuestions(userAssessment.assessment.type);
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete assessment
      completeAssessmentMutation.mutate(responses);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !userAssessment) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Alert variant="destructive">
            <AlertDescription>
              Assessment not found or you don't have access to this assessment.
            </AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  const questions = getAssessmentQuestions(userAssessment.assessment.type);
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-background">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => window.history.back()} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-foreground">
            {userAssessment.assessment.name}
          </h1>
          <p className="text-neutral-500 dark:text-muted-foreground mt-2">
            {userAssessment.assessment.description}
          </p>
        </div>

        {userAssessment.status === 'available' && (
          <Card>
            <CardHeader>
              <CardTitle>Siap untuk Memulai</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-neutral-500" />
                  <span>{userAssessment.assessment.duration}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-neutral-500" />
                  <span>{userAssessment.assessment.ageRange}</span>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Before You Begin:
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Find a quiet, comfortable environment</li>
                  <li>• Answer all questions honestly</li>
                  <li>• Take your time - there's no rush</li>
                  <li>• You can save your progress and return later</li>
                </ul>
              </div>

              <Button 
                size="lg" 
                onClick={handleStartAssessment}
                disabled={startAssessmentMutation.isPending}
                className="w-full"
              >
                {startAssessmentMutation.isPending ? "Starting..." : "Start Assessment"}
              </Button>
            </CardContent>
          </Card>
        )}

        {userAssessment.status === 'in_progress' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Question {currentStep + 1} of {questions.length}</CardTitle>
                <span className="text-sm text-neutral-500 dark:text-muted-foreground">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <Progress value={progress} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-foreground mb-4">
                  {currentQuestion.question}
                </h2>
                
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.value}
                        checked={responses[currentQuestion.id] === option.value}
                        onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
                        className="text-primary"
                      />
                      <span className="text-neutral-900 dark:text-foreground">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePreviousStep}
                  disabled={currentStep === 0}
                >
                  Previous
                </Button>
                
                <Button
                  onClick={handleNextStep}
                  disabled={!responses[currentQuestion.id] || completeAssessmentMutation.isPending}
                >
                  {currentStep === questions.length - 1 
                    ? (completeAssessmentMutation.isPending ? "Completing..." : "Complete Assessment")
                    : "Next"
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {userAssessment.status === 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>Assessment Completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-foreground mb-2">
                  Congratulations!
                </h2>
                <p className="text-neutral-500 dark:text-muted-foreground mb-6">
                  You have successfully completed the {userAssessment.assessment.name}.
                </p>
                <p className="text-sm text-neutral-400 dark:text-muted-foreground">
                  Completed on {userAssessment.completedAt 
                    ? formatDisplayDate(userAssessment.completedAt)
                    : 'Recently'
                  }
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  What's Next?
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your assessment results are being processed. You will receive a detailed 
                  report with insights and recommendations based on your responses.
                </p>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1">
                  View Detailed Report
                </Button>
                <Button variant="outline" className="flex-1">
                  Share Results
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}

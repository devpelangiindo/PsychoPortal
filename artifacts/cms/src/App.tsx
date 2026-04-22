import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import PagesCollectionPage from "@/pages/pages-collection";
import PostsCollectionPage from "@/pages/posts-collection";
import TeamMembersCollectionPage from "@/pages/team-members-collection";
import ServicesCollectionPage from "@/pages/services-collection";
import { api } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cms_token");
    if (!token) {
      setChecking(false);
      navigate("/login");
      return;
    }
    api
      .me()
      .then((user) => {
        if (user.role === "admin" || user.role === "internal") {
          setAuthed(true);
        } else {
          localStorage.removeItem("cms_token");
          navigate("/login");
        }
      })
      .catch(() => {
        localStorage.removeItem("cms_token");
        navigate("/login");
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground">Memverifikasi...</div>
        </div>
      </div>
    );
  }

  if (!authed) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <AuthGuard>
          <DashboardPage />
        </AuthGuard>
      </Route>
      <Route path="/pages">
        <AuthGuard>
          <PagesCollectionPage />
        </AuthGuard>
      </Route>
      <Route path="/posts">
        <AuthGuard>
          <PostsCollectionPage />
        </AuthGuard>
      </Route>
      <Route path="/team-members">
        <AuthGuard>
          <TeamMembersCollectionPage />
        </AuthGuard>
      </Route>
      <Route path="/services">
        <AuthGuard>
          <ServicesCollectionPage />
        </AuthGuard>
      </Route>
      <Route>
        <AuthGuard>
          <DashboardPage />
        </AuthGuard>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

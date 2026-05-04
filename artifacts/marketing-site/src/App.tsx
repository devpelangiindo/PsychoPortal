import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiWhatsapp } from "react-icons/si";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TentangKami from "@/pages/TentangKami";
import ProdukLayanan from "@/pages/ProdukLayanan";
import Artikel from "@/pages/Artikel";
import Kontak from "@/pages/Kontak";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tentang-kami" component={TentangKami} />
      <Route path="/produk-layanan" component={ProdukLayanan} />
      <Route path="/produk-layanan/:slug" component={ProdukLayanan} />
      <Route path="/artikel" component={Artikel} />
      <Route path="/artikel/:slug" component={Artikel} />
      <Route path="/kontak" component={Kontak} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <a
            href="https://wa.me/62816669533"
            target="_blank"
            rel="noopener noreferrer"
            className="wa-float"
            aria-label="Chat via WhatsApp"
          >
            <SiWhatsapp size={26} color="white" />
          </a>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

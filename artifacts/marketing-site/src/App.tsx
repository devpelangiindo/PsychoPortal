import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WhatsAppBranchChooser from "@/components/WhatsAppBranchChooser";
import WebsiteAnalytics from "@/components/WebsiteAnalytics";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TentangKami from "@/pages/TentangKami";
import ProdukLayanan from "@/pages/ProdukLayanan";
import DigitalProducts from "@/pages/DigitalProducts";
import PhysicalProducts from "@/pages/PhysicalProducts";
import EducationProducts, { LegacyDigitalProductsRedirect } from "@/pages/EducationProducts";
import PsychologyTestTools from "@/pages/PsychologyTestTools";
import TherapyCategories from "@/pages/TherapyCategories";
import CoursePage from "@/pages/CoursePage";
import TrainingPage from "@/pages/TrainingPage";
import HospitalityServices from "@/pages/HospitalityServices";
import Artikel, { ArticleDetailPage } from "@/pages/Artikel";
import Kontak from "@/pages/Kontak";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tentang-kami" component={TentangKami} />
      <Route path="/produk-layanan" component={ProdukLayanan} />
      <Route path="/produk-layanan/produk-edukasi/produk-digital/:productSlug" component={DigitalProducts} />
      <Route path="/produk-layanan/produk-edukasi/produk-digital" component={DigitalProducts} />
      <Route path="/produk-layanan/produk-edukasi/produk-fisik/:productSlug" component={PhysicalProducts} />
      <Route path="/produk-layanan/produk-edukasi/produk-fisik" component={PhysicalProducts} />
      <Route path="/produk-layanan/produk-edukasi/alat-tes-psikologi" component={PsychologyTestTools} />
      <Route path="/produk-layanan/produk-edukasi" component={EducationProducts} />
      <Route path="/produk-layanan/produk-digital/:productSlug" component={LegacyDigitalProductsRedirect} />
      <Route path="/produk-layanan/produk-digital" component={LegacyDigitalProductsRedirect} />
      <Route path="/produk-layanan/terapi/:categorySlug" component={TherapyCategories} />
      <Route path="/produk-layanan/terapi" component={TherapyCategories} />
      <Route path="/produk-layanan/kursus" component={CoursePage} />
      <Route path="/produk-layanan/pelatihan/:trainingSlug" component={TrainingPage} />
      <Route path="/produk-layanan/pelatihan" component={TrainingPage} />
      <Route path="/produk-layanan/horecal/:serviceSlug" component={HospitalityServices} />
      <Route path="/produk-layanan/horecal" component={HospitalityServices} />
      <Route path="/produk-layanan/:slug" component={ProdukLayanan} />
      <Route path="/artikel" component={Artikel} />
      <Route path="/artikel/:slug" component={ArticleDetailPage} />
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

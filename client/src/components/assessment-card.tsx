import { Brain, GraduationCap, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart";
import type { Assessment } from "@shared/schema";

interface AssessmentCardProps {
  assessment: Assessment;
  showAddToCart: boolean;
}

export default function AssessmentCard({ assessment, showAddToCart }: AssessmentCardProps) {
  const { toast } = useToast();
  const { addItem, items } = useCart();

  const isInCart = items.some(item => item.id === assessment.id);

  const getIcon = (type: string) => {
    if (type === 'sensory') {
      return <Brain className="w-12 h-12 text-secondary" />;
    }
    return <GraduationCap className="w-12 h-12 text-accent" />;
  };

  const getGradientClass = (type: string) => {
    if (type === 'sensory') {
      return 'bg-secondary-light';
    }
    return 'bg-accent-light';
  };

  const getIconLabel = (type: string) => {
    if (type === 'sensory') {
      return 'Pemrosesan Sensoris';
    }
    return 'Preferensi Belajar';
  };

  const handleAddToCart = () => {
    if (isInCart) {
      toast({
        title: "Sudah di Keranjang",
        description: "Asesmen ini sudah ada di keranjang Anda.",
        variant: "default",
      });
      return;
    }

    addItem({
      id: assessment.id,
      name: assessment.name,
      price: assessment.price,
      description: assessment.description,
      duration: assessment.duration,
      ageRange: assessment.ageRange,
      type: assessment.type,
    });

    toast({
      title: "Ditambahkan ke Keranjang",
      description: `${assessment.name} telah ditambahkan ke keranjang Anda.`,
      variant: "default",
    });
  };

  return (
    <Card className="assessment-card-hover bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-100 dark:border-border overflow-hidden">
      {/* Professional assessment illustration */}
      <div className={`h-48 ${getGradientClass(assessment.type)} flex items-center justify-center`}>
        <div className="text-center">
          {getIcon(assessment.type)}
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground mt-4">
            {getIconLabel(assessment.type)}
          </h3>
        </div>
      </div>
      
      <CardContent className="p-8">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-foreground mb-4">
          {assessment.name}
        </h3>
        <p className="text-neutral-500 dark:text-muted-foreground mb-6 leading-relaxed">
          {assessment.description}
        </p>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center text-sm text-neutral-500 dark:text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            <span>{assessment.duration}</span>
          </div>
          <div className="flex items-center text-sm text-neutral-500 dark:text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            <span>{assessment.ageRange}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-baseline text-primary">
            <span className="text-lg font-semibold mr-1">Rp</span>
            <span className="text-2xl font-bold">{new Intl.NumberFormat('id-ID').format(parseFloat(assessment.price))}</span>
          </div>
          {showAddToCart && (
            <Button
              onClick={handleAddToCart}
              disabled={isInCart}
              size="lg"
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg ${
                isInCart 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
              }`}
            >
              {isInCart ? "✓ Di Keranjang" : "🛒 Tambah ke Keranjang"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

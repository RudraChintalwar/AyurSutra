import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Upload,
  FlaskConical,
  Pill,
  Leaf
} from 'lucide-react';

const MedicineVerifier = () => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const handleVerify = async () => {
    if (!inputText.trim()) {
      toast({ title: t("medicine.enterLabel"), variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setResult(null);

    try {
      const ML_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8000';
      const response = await fetch(`${ML_URL}/authenticate-medicine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Authentication error:', err);
      toast({
        title: language === "hi" ? "त्रुटि" : "Error",
        description: t("medicine.authFailed"),
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sampleLabels = [
    "Triphala Churna - Dabur India Ltd. Contains: Amalaki (Emblica officinalis), Bibhitaki (Terminalia bellirica), Haritaki (Terminalia chebula). Ayurvedic Proprietary Medicine.",
    "Ashwagandha Capsules - Himalaya Wellness. Contains: Withania somnifera root extract 250mg. GMP Certified. AYUSH License No: 25D/244/2023.",
    "Unknown Herbal Mix - No manufacturer listed. Contains unspecified herbs. No batch number.",
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary flex items-center">
            <Shield className="w-8 h-8 mr-3" />
            {t("medicine.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("medicine.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="ayur-card p-6">
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <Search className="w-5 h-5 mr-2 text-primary" />
            {t("medicine.labelInput")}
          </h3>
          <Textarea
            placeholder={t("medicine.placeholder")}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[200px] mb-4"
          />
          <Button
            className="ayur-button-hero w-full"
            onClick={handleVerify}
            disabled={isAnalyzing || !inputText.trim()}
          >
            {isAnalyzing ? (
              <>
                <FlaskConical className="w-4 h-4 mr-2 animate-spin" />
                {t("medicine.analyzing")}
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                {t("medicine.authenticate")}
              </>
            )}
          </Button>

          <div className="mt-6">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{t("medicine.trySamples")}</h4>
            <div className="space-y-2">
              {sampleLabels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setInputText(label)}
                  className="w-full text-left p-3 text-sm bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start space-x-2">
                    <Pill className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="line-clamp-2">{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Results Panel */}
        <Card className="ayur-card p-6">
          <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
            <FlaskConical className="w-5 h-5 mr-2 text-primary" />
            {t("medicine.results")}
          </h3>

          {!result && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">{t("medicine.emptyTitle")}</p>
              <p className="text-sm mt-2">{t("medicine.emptyDesc")}</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-primary font-medium">{t("medicine.analyzingLabel")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("medicine.pipeline")}</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-slide-up">
              {/* Main Result */}
              <div className={`p-6 rounded-xl text-center ${
                result.classification === 'Authentic'
                  ? 'bg-green-50 border-2 border-green-200'
                  : result.classification === 'Suspicious'
                  ? 'bg-red-50 border-2 border-red-200'
                  : 'bg-yellow-50 border-2 border-yellow-200'
              }`}>
                {result.classification === 'Authentic' ? (
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-3" />
                ) : result.classification === 'Suspicious' ? (
                  <XCircle className="w-12 h-12 mx-auto text-red-600 mb-3" />
                ) : (
                  <AlertTriangle className="w-12 h-12 mx-auto text-yellow-600 mb-3" />
                )}
                <h3 className="text-2xl font-bold mb-1">
                  {result.classification === "Authentic"
                    ? t("medicine.class.authentic")
                    : result.classification === "Suspicious"
                    ? t("medicine.class.suspicious")
                    : t("medicine.class.unknown")}
                </h3>
                <p className="text-muted-foreground">
                  {t("medicine.confidence")}: {Math.round((result.confidence || 0) * 100)}%
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {result.formulation && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium flex items-center">
                      <Leaf className="w-4 h-4 mr-2 text-primary" />
                      {t("medicine.formulation")}
                    </span>
                    <Badge className="capitalize">{result.formulation}</Badge>
                  </div>
                )}
                {result.ingredient_matches !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">{t("medicine.ingredientMatches")}</span>
                    <Badge variant="outline">{result.ingredient_matches} {t("medicine.found")}</Badge>
                  </div>
                )}
                {result.manufacturer_verified !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">{t("medicine.manufacturerVerified")}</span>
                    <Badge variant={result.manufacturer_verified ? "default" : "destructive"}>
                      {result.manufacturer_verified ? `✅ ${t("medicine.verified")}` : `❌ ${t("medicine.notVerified")}`}
                    </Badge>
                  </div>
                )}
                {result.reason && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {result.reason}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MedicineVerifier;

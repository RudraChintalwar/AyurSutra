import React, { useState, useRef } from 'react';
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
  Leaf,
  Camera,
  Image as ImageIcon,
  Type,
  X,
  FileText
} from 'lucide-react';

type InputMode = 'image' | 'text';

const MedicineVerifier = () => {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: language === 'hi' ? 'कृपया एक छवि फ़ाइल चुनें' : 'Please select an image file', variant: 'destructive' });
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: language === 'hi' ? 'छवि 10MB से छोटी होनी चाहिए' : 'Image must be under 10MB', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleVerify = async () => {
    if (inputMode === 'text' && !inputText.trim()) {
      toast({ title: t("medicine.enterLabel"), variant: "destructive" });
      return;
    }
    if (inputMode === 'image' && !imageBase64 && !inputText.trim()) {
      toast({
        title: language === 'hi' ? 'कृपया एक दवा लेबल की छवि अपलोड करें' : 'Please upload a medicine label image',
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const ML_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8000';

      const payload: { text: string; image_base64: string } = {
        text: inputText,
        image_base64: imageBase64 || ''
      };

      const response = await fetch(`${ML_URL}/authenticate-medicine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  const canVerify = inputMode === 'image'
    ? !!(imageBase64 || inputText.trim())
    : !!inputText.trim();

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
          {/* Mode Toggle Tabs */}
          <div className="flex items-center gap-2 mb-5 p-1 bg-muted/40 rounded-xl">
            <button
              onClick={() => setInputMode('image')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'image'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Camera className="w-4 h-4" />
              {language === 'hi' ? 'छवि अपलोड करें' : 'Upload Image'}
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'text'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Type className="w-4 h-4" />
              {language === 'hi' ? 'टेक्स्ट टाइप करें' : 'Type Text'}
            </button>
          </div>

          {/* Image Upload Mode */}
          {inputMode === 'image' && (
            <div className="space-y-4">
              <h3 className="font-playfair text-xl font-semibold flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-primary" />
                {language === 'hi' ? 'दवा लेबल स्कैन करें' : 'Scan Medicine Label'}
              </h3>

              {!imagePreview ? (
                <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {language === 'hi' ? 'दवा लेबल की फोटो अपलोड करें' : 'Upload a photo of the medicine label'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === 'hi' ? 'PNG, JPG या JPEG (अधिकतम 10MB)' : 'PNG, JPG, or JPEG (max 10MB)'}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        {language === 'hi' ? 'फ़ाइल चुनें' : 'Choose File'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        {language === 'hi' ? 'कैमरा' : 'Camera'}
                      </Button>
                    </div>
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img
                    src={imagePreview}
                    alt="Medicine label"
                    className="w-full max-h-[280px] object-contain bg-muted/20"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <p className="text-white text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {language === 'hi' ? 'छवि लोड हुई — OCR निष्कर्षण के लिए तैयार' : 'Image loaded — ready for OCR extraction'}
                    </p>
                  </div>
                </div>
              )}

              {/* Optional additional text in image mode */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {language === 'hi'
                    ? 'अतिरिक्त टेक्स्ट (वैकल्पिक — OCR परिणाम को पूरक करता है)'
                    : 'Additional text (optional — supplements OCR result)'}
                </label>
                <Textarea
                  placeholder={language === 'hi'
                    ? 'यदि लेबल पर कुछ अतिरिक्त जानकारी हो तो यहाँ लिखें...'
                    : 'Add any extra info visible on the label here...'}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <div className="space-y-4">
              <h3 className="font-playfair text-xl font-semibold flex items-center">
                <Search className="w-5 h-5 mr-2 text-primary" />
                {t("medicine.labelInput")}
              </h3>
              <Textarea
                placeholder={t("medicine.placeholder")}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[200px]"
              />

              <div className="mt-2">
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
            </div>
          )}

          {/* Verify Button */}
          <Button
            className="ayur-button-hero w-full mt-5"
            onClick={handleVerify}
            disabled={isAnalyzing || !canVerify}
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

              {/* OCR Extracted Text */}
              {result.ocr_text && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">
                      {language === 'hi' ? 'OCR से निकाला गया टेक्स्ट' : 'OCR Extracted Text'}
                    </span>
                  </div>
                  <p className="text-sm text-blue-900/80 whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto">
                    {result.ocr_text}
                  </p>
                </div>
              )}

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
                {result.model_used && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">
                      {language === 'hi' ? 'मॉडल' : 'Model Used'}
                    </span>
                    <Badge variant="outline">{result.model_used}</Badge>
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

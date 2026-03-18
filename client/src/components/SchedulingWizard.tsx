import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { 
  User,
  Calendar,
  Brain,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Star,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';

interface SchedulingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sessionData: any) => void;
}

const SchedulingWizard: React.FC<SchedulingWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Patient Details
    name: '',
    phone: '',
    email: '',
    reason: '',
    
    // Step 2: Assessment
    symptoms: [] as string[],
    symptomScores: {} as Record<string, number>,
    constitution: 'Vata',
    
    // Step 3: LLM Recommendation (populated automatically)
    recommendation: null as any,
    
    // Step 4: Schedule
    selectedSlots: [] as string[],
    confirmed: false
  });

  const symptomOptions = [
    'Headache', 'Bloating', 'Fatigue', 'Insomnia', 'Joint stiffness', 
    'Anxiety', 'Digestive issues', 'Low energy', 'Mood swings', 'Stress'
  ];

  const constitutionTypes = ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha'];

  const [mockSlots, setMockSlots] = useState<string[]>([
    '2025-10-01T09:00:00+05:30',
    '2025-10-01T14:00:00+05:30',
    '2025-10-02T10:00:00+05:30',
    '2025-10-03T11:00:00+05:30',
    '2025-10-03T15:00:00+05:30'
  ]);

  const handleSymptomToggle = (symptom: string) => {
    const newSymptoms = formData.symptoms.includes(symptom)
      ? formData.symptoms.filter(s => s !== symptom)
      : [...formData.symptoms, symptom];
    
    setFormData(prev => ({ ...prev, symptoms: newSymptoms }));
  };

  const handleSymptomScore = (symptom: string, score: number) => {
    setFormData(prev => ({
      ...prev,
      symptomScores: { ...prev.symptomScores, [symptom]: score }
    }));
  };

  const generateLLMRecommendation = async () => {
    setIsLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const symptomsPayload = formData.symptoms.map(s => ({
        name: s,
        score: formData.symptomScores[s] || 5
      }));

      // 1. Get recommendation from Groq + ML Node API
      const response = await fetch(`${BACKEND_URL}/api/scheduling/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: symptomsPayload,
          dosha: formData.constitution,
          age: 35, // Could be gathered in form
          gender: 'Unknown',
          reason: formData.reason
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.recommendation) {
        setFormData(prev => ({ ...prev, recommendation: data.recommendation }));
        
        // 2. Generate optimal slots based on recommendation
        const slotsResponse = await fetch(`${BACKEND_URL}/api/scheduling/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            practitionerId: 'dr1',
            spacingDays: data.recommendation.spacing_days,
            sessionsNeeded: data.recommendation.sessions_recommended,
            startDate: new Date().toISOString()
          })
        });
        
        const slotsData = await slotsResponse.json();
        if (slotsData.success && slotsData.slots) {
          setMockSlots(slotsData.slots);
        }
      } else {
        throw new Error(data.error || "Failed to generate recommendation");
      }
    } catch (error) {
      console.error("Error generating recommendation:", error);
      // Fallback if API fails
      setFormData(prev => ({ ...prev, recommendation: {
        therapy: 'Abhyanga (oil massage) - Fallback',
        sessions_recommended: 3,
        spacing_days: 7,
        priority_score: 60,
        explanation: 'Could not connect to AI services. This is a fallback recommendation based on general wellness.',
        confidence: 70
      }}));
    } finally {
      setIsLoading(false);
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      generateLLMRecommendation();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleComplete = () => {
    const sessionData = {
      patient: formData,
      recommendation: formData.recommendation,
      scheduledSlots: formData.selectedSlots
    };
    onComplete(sessionData);
    onClose();
  };

  const formatSlotTime = (slot: string) => {
    return new Date(slot).toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.name && formData.phone && formData.reason;
      case 2: return formData.symptoms.length > 0 && Object.keys(formData.symptomScores).length > 0;
      case 3: return formData.recommendation;
      case 4: return formData.selectedSlots.length > 0;
      default: return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-2xl flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-primary" />
            <span>Schedule New Session - Step {currentStep} of 4</span>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step <= currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Step 1: Patient Details */}
          {currentStep === 1 && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-playfair text-xl font-semibold">Patient Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter patient's full name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+91-9876543210"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="patient@example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="constitution">Constitution</Label>
                  <select
                    id="constitution"
                    value={formData.constitution}
                    onChange={(e) => setFormData(prev => ({ ...prev, constitution: e.target.value }))}
                    className="w-full p-2 border border-border rounded-md"
                  >
                    {constitutionTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <Label htmlFor="reason">Reason for Visit *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Describe the main health concerns or symptoms..."
                  rows={3}
                />
              </div>
            </Card>
          )}

          {/* Step 2: Dosha & Assessment */}
          {currentStep === 2 && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="font-playfair text-xl font-semibold">Symptom Assessment</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium mb-3 block">Current Symptoms</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {symptomOptions.map((symptom) => (
                      <label key={symptom} className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          checked={formData.symptoms.includes(symptom)}
                          onCheckedChange={() => handleSymptomToggle(symptom)}
                        />
                        <span className="text-sm">{symptom}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.symptoms.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Symptom Severity (1-10)</Label>
                    {formData.symptoms.map((symptom) => (
                      <div key={symptom} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{symptom}</span>
                          <Badge variant="outline">
                            {formData.symptomScores[symptom] || 5}/10
                          </Badge>
                        </div>
                        <Slider
                          value={[formData.symptomScores[symptom] || 5]}
                          onValueChange={(value) => handleSymptomScore(symptom, value[0])}
                          max={10}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Step 3: LLM Recommendation */}
          {currentStep === 3 && formData.recommendation && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="font-playfair text-xl font-semibold">AI Treatment Recommendation</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg text-primary">
                      {formData.recommendation.therapy}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <Badge className="priority-badge-high">
                        Priority: {formData.recommendation.priority_score}
                      </Badge>
                      <Badge variant="outline">
                        <Star className="w-3 h-3 mr-1" />
                        {formData.recommendation.confidence}% Confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {formData.recommendation.sessions_recommended}
                      </div>
                      <div className="text-sm text-muted-foreground">Sessions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {formData.recommendation.spacing_days}
                      </div>
                      <div className="text-sm text-muted-foreground">Days Apart</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-ayur-soft-gold">
                        {formData.recommendation.sessions_recommended * formData.recommendation.spacing_days}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Days</div>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {formData.recommendation.explanation}
                  </p>

                  <div className="flex items-center space-x-3">
                    <Button className="ayur-button-hero">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept & Schedule
                    </Button>
                    <Button variant="outline">
                      Edit Recommendation
                    </Button>
                    <Button variant="outline">
                      Send to Practitioner
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Schedule Selection */}
          {currentStep === 4 && (
            <Card className="ayur-card p-6 animate-scale-in">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-playfair text-xl font-semibold">Select Time Slots</h3>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Based on your treatment plan, we recommend the following available slots:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mockSlots.slice(0, formData.recommendation?.sessions_recommended || 3).map((slot, index) => (
                    <label
                      key={slot}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.selectedSlots.includes(slot)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={formData.selectedSlots.includes(slot)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({
                                ...prev,
                                selectedSlots: [...prev.selectedSlots, slot]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                selectedSlots: prev.selectedSlots.filter(s => s !== slot)
                              }));
                            }
                          }}
                        />
                        <div>
                          <div className="font-medium">Session {index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatSlotTime(slot)}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {formData.recommendation?.therapy?.includes('Vamana') ? '120' : '90'} min
                      </Badge>
                    </label>
                  ))}
                </div>

                {formData.selectedSlots.length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800">
                        {formData.selectedSlots.length} sessions selected
                      </span>
                    </div>
                    <p className="text-sm text-green-700">
                      Your sessions have been optimally spaced according to the AI recommendation.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? onClose : handleBack}
              disabled={currentStep === 3 && !formData.recommendation}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                className="ayur-button-hero"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Next Step"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!canProceed()}
                className="ayur-button-accent"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm & Schedule
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingWizard;
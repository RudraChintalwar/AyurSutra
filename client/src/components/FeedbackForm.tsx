import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Star,
  TrendingUp,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { mockData } from '@/data/mockData';

interface FeedbackFormProps {
  sessionId: string;
  onSubmit: (feedback: any) => void;
  onCancel: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ sessionId, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    pain: [0],
    digestion: [5],
    energy: [5],
    sleep: [5],
    notes: '',
    symptoms: [] as string[],
    overall_satisfaction: [4]
  });

  const symptomTags = [
    'Nausea', 'Dizziness', 'Better Sleep', 'Increased Energy', 
    'Reduced Pain', 'Improved Digestion', 'Mental Clarity', 'Relaxation'
  ];

  const handleSliderChange = (key: string, value: number[]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSymptomToggle = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const handleSubmit = () => {
    const feedback = {
      submitted_at: new Date().toISOString(),
      symptom_scores: {
        'Pain Level': formData.pain[0],
        'Digestion': formData.digestion[0],
        'Energy Level': formData.energy[0],
        'Sleep Quality': formData.sleep[0]
      },
      notes: formData.notes,
      symptoms: formData.symptoms,
      overall_satisfaction: formData.overall_satisfaction[0],
      action: formData.pain[0] > 7 || formData.digestion[0] < 3 ? 'require_more_sessions' : 
              formData.overall_satisfaction[0] >= 4 ? 'no_change_needed' : 'suggest_additional_rest'
    };

    // Simulate LLM processing
    setTimeout(() => {
      const llmResponse = mockData.llm_responses_for_feedback.find(
        response => response.feedback_action === feedback.action
      );
      
      onSubmit({
        feedback,
        llmResponse: llmResponse?.result || mockData.llm_responses_for_feedback[1].result
      });
    }, 1000);
  };

  const getScoreColor = (score: number, reverse = false) => {
    if (reverse) {
      if (score <= 3) return 'text-green-600';
      if (score <= 6) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="ayur-card p-6 max-w-2xl mx-auto animate-scale-in">
      <div className="mb-6">
        <h3 className="font-playfair text-2xl font-bold text-primary mb-2">
          Session Feedback
        </h3>
        <p className="text-muted-foreground">
          Help us understand your experience and optimize your treatment plan
        </p>
      </div>

      <div className="space-y-6">
        {/* Pain Level */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Pain Level</Label>
            <Badge variant="outline" className={getScoreColor(formData.pain[0], true)}>
              {formData.pain[0]}/10
            </Badge>
          </div>
          <Slider
            value={formData.pain}
            onValueChange={(value) => handleSliderChange('pain', value)}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>No Pain</span>
            <span>Severe Pain</span>
          </div>
        </div>

        {/* Digestion */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Digestion Quality</Label>
            <Badge variant="outline" className={getScoreColor(formData.digestion[0])}>
              {formData.digestion[0]}/10
            </Badge>
          </div>
          <Slider
            value={formData.digestion}
            onValueChange={(value) => handleSliderChange('digestion', value)}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Energy Level */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Energy Level</Label>
            <Badge variant="outline" className={getScoreColor(formData.energy[0])}>
              {formData.energy[0]}/10
            </Badge>
          </div>
          <Slider
            value={formData.energy}
            onValueChange={(value) => handleSliderChange('energy', value)}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Very Low</span>
            <span>Very High</span>
          </div>
        </div>

        {/* Sleep Quality */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Sleep Quality</Label>
            <Badge variant="outline" className={getScoreColor(formData.sleep[0])}>
              {formData.sleep[0]}/10
            </Badge>
          </div>
          <Slider
            value={formData.sleep}
            onValueChange={(value) => handleSliderChange('sleep', value)}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Overall Satisfaction */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Overall Satisfaction</Label>
            <div className="flex items-center space-x-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${
                    i < formData.overall_satisfaction[0] 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'text-gray-300'
                  }`} 
                />
              ))}
            </div>
          </div>
          <Slider
            value={formData.overall_satisfaction}
            onValueChange={(value) => handleSliderChange('overall_satisfaction', value)}
            max={5}
            min={1}
            step={1}
            className="w-full"
          />
        </div>

        {/* Symptom Tags */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Experienced Symptoms/Benefits</Label>
          <div className="flex flex-wrap gap-2">
            {symptomTags.map((symptom) => (
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

        {/* Notes */}
        <div className="space-y-3">
          <Label htmlFor="notes" className="text-base font-medium">Additional Notes</Label>
          <Textarea
            id="notes"
            placeholder="Describe your overall experience, any side effects, or specific observations..."
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="min-h-[80px]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="ayur-button-hero">
            <CheckCircle className="w-4 h-4 mr-2" />
            Submit Feedback
          </Button>
        </div>

        {/* AI Analysis Preview */}
        <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI Analysis Preview</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Based on your feedback, our AI will analyze your progress and suggest any necessary adjustments to your treatment plan.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default FeedbackForm;
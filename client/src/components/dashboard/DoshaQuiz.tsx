import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import './DoshaQuiz.css';

const quizQuestions = [
  { id: 1, question: "What best describes your body frame?", options: [
    { text: "Thin, light, bony", value: "vata" },
    { text: "Medium, muscular, well-proportioned", value: "pitta" },
    { text: "Large, solid, gains weight easily", value: "kapha" }
  ]},
  { id: 2, question: "How is your appetite typically?", options: [
    { text: "Irregular, sometimes hungry, sometimes not", value: "vata" },
    { text: "Strong, get hungry if I miss a meal", value: "pitta" },
    { text: "Steady, can skip meals without issue", value: "kapha" }
  ]},
  { id: 3, question: "How do you handle cold weather?", options: [
    { text: "Dislike cold, get cold easily", value: "vata" },
    { text: "Prefer cooler temperatures, handle heat poorly", value: "pitta" },
    { text: "Tolerate cold well, dislike dampness", value: "kapha" }
  ]},
  { id: 4, question: "What describes your sleep pattern?", options: [
    { text: "Light sleeper, easily disturbed", value: "vata" },
    { text: "Moderate sleeper, wake up easily", value: "pitta" },
    { text: "Deep sleeper, hard to wake up", value: "kapha" }
  ]},
  { id: 5, question: "How is your digestion?", options: [
    { text: "Variable, sometimes constipated", value: "vata" },
    { text: "Strong, regular bowel movements", value: "pitta" },
    { text: "Slow, heavy after meals", value: "kapha" }
  ]},
  { id: 6, question: "What describes your personality?", options: [
    { text: "Creative, enthusiastic, anxious at times", value: "vata" },
    { text: "Intense, focused, easily irritated", value: "pitta" },
    { text: "Calm, steady, sometimes lethargic", value: "kapha" }
  ]},
  { id: 7, question: "How is your skin?", options: [
    { text: "Dry, thin, cool to touch", value: "vata" },
    { text: "Warm, oily, prone to rashes", value: "pitta" },
    { text: "Thick, oily, cool and pale", value: "kapha" }
  ]},
  { id: 8, question: "How do you make decisions?", options: [
    { text: "Quickly, but change my mind often", value: "vata" },
    { text: "Decisively, based on logic", value: "pitta" },
    { text: "Slowly, after careful consideration", value: "kapha" }
  ]},
  { id: 9, question: "What describes your energy levels?", options: [
    { text: "Bursts of energy, then fatigue", value: "vata" },
    { text: "Steady energy throughout the day", value: "pitta" },
    { text: "Consistent but sometimes sluggish", value: "kapha" }
  ]},
  { id: 10, question: "How is your hair?", options: [
    { text: "Dry, thin, curly", value: "vata" },
    { text: "Fine, oily, premature graying", value: "pitta" },
    { text: "Thick, oily, wavy or straight", value: "kapha" }
  ]},
  { id: 11, question: "How do you respond to stress?", options: [
    { text: "Worry, anxiety, irregular habits", value: "vata" },
    { text: "Frustration, anger, criticism", value: "pitta" },
    { text: "Avoidance, withdrawal, inaction", value: "kapha" }
  ]},
  { id: 12, question: "What describes your speech pattern?", options: [
    { text: "Fast, enthusiastic, often changing topics", value: "vata" },
    { text: "Clear, precise, persuasive", value: "pitta" },
    { text: "Slow, methodical, few words", value: "kapha" }
  ]}
];

const generateRecommendations = (dosha: string) => {
  const recommendations: any = {
    vata: [
      "Follow a regular daily routine",
      "Favor warm, moist, and grounding foods",
      "Practice gentle yoga and meditation",
      "Get adequate rest and avoid overexertion",
      "Stay warm in cold, windy weather"
    ],
    pitta: [
      "Avoid excessive heat and steam",
      "Favor cool, refreshing foods",
      "Practice cooling breathing exercises",
      "Avoid excessive competition",
      "Engage in relaxing activities near water"
    ],
    kapha: [
      "Seek variety and new experiences",
      "Engage in regular vigorous exercise",
      "Favor light, warm, and dry foods",
      "Avoid heavy, oily foods",
      "Wake up early and avoid daytime sleep"
    ]
  };
  return recommendations[dosha] || [];
};

const calculateHealthScore = (scores: any) => {
  const total = scores.vata + scores.pitta + scores.kapha;
  const balance = 100 - (Math.max(scores.vata, scores.pitta, scores.kapha) / total * 100 - 33);
  return Math.min(Math.round(balance), 100);
};

export default function DoshaQuiz({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userWithProfile = user as any;
    if (userWithProfile && userWithProfile.doshaProfile) {
      setQuizCompleted(true);
      setUserProfile(userWithProfile.doshaProfile);
    }
  }, [user]);

  const startQuiz = () => setQuizStarted(true);

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [currentQuestion]: value };
    setAnswers(newAnswers);

    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      completeQuiz(newAnswers);
    }
  };

  const completeQuiz = async (answerData: Record<number, string>) => {
    setLoading(true);
    let scores = { vata: 0, pitta: 0, kapha: 0 };
    Object.values(answerData).forEach((answer) => {
      scores[answer as keyof typeof scores] += 1;
    });

    const primaryDosha = Object.keys(scores).reduce((a, b) => 
      scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b
    );

    const profile = {
      primaryDosha,
      scores,
      recommendations: generateRecommendations(primaryDosha),
      healthScore: calculateHealthScore(scores),
      completedAt: new Date().toISOString()
    };

    try {
      if (user?.uid) {
        await setDoc(doc(db, "users", user.uid), {
          doshaProfile: profile,
          dosha: primaryDosha.charAt(0).toUpperCase() + primaryDosha.slice(1),
          quizCompleted: true
        }, { merge: true });
        toast({ title: "Result Saved", description: `Your primary dosha is ${primaryDosha}.` });
      }
      setUserProfile(profile);
      setQuizCompleted(true);
      if (onComplete) onComplete();
    } catch (error: any) {
      toast({ title: "Error saving quiz", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8f5f0' });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("Ayurvedic_Report.pdf");
      toast({ title: "Generated PDF successfully!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  // Animations
  useEffect(() => {
    if (quizCompleted && userProfile) {
      gsap.fromTo(".ad-completion-card", 
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" }
      );
    }
  }, [quizCompleted, userProfile]);

  if (quizCompleted && userProfile) {
    return (
      <div className="w-full mb-8" ref={pdfRef}>
        <div className="ad-completion-card mx-auto max-w-3xl">
          <div className="ad-completion-icon text-5xl mb-4">✅</div>
          <h3 className="font-playfair text-3xl font-bold text-primary mb-2">Ayurvedic Profile Complete</h3>
          <p className="text-muted-foreground mb-6">
            Your primary constitution is <strong className="text-primary capitalize text-xl">{userProfile.primaryDosha}</strong>.
            Your mind-body balance score is {userProfile.healthScore}%.
          </p>

          <div className="bg-white/50 p-6 rounded-xl border border-primary/20 mb-6 text-left">
            <h4 className="font-semibold text-lg text-primary mb-3">Recommendations for {userProfile.primaryDosha}:</h4>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              {userProfile.recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={handleDownload} className="ayur-button-hero">
              Download PDF Report 📄
            </Button>
            <Button variant="outline" onClick={() => {
              setQuizCompleted(false);
              setQuizStarted(false);
              setAnswers({});
              setCurrentQuestion(0);
            }}>Retake Quiz</Button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = quizQuestions[currentQuestion];

  return (
    <div className="w-full mb-8">
      {!quizStarted ? (
        <div className="ad-quiz-card mx-auto max-w-2xl text-center">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="font-playfair text-3xl font-bold text-primary mb-4">Ayurvedic Body Type Analysis</h3>
          <p className="text-muted-foreground mb-6">
            This 12-question assessment helps determine your unique mind-body constitution (Dosha) 
            according to Ayurvedic principles. Discover your dominant energy and get personalized recommendations.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6 text-sm text-primary font-medium">
            <div className="flex items-center gap-2"><span>⏱️</span> 5-7 min</div>
            <div className="flex items-center gap-2"><span>📊</span> Detailed analysis</div>
            <div className="flex items-center gap-2"><span>🌿</span> Personal plan</div>
          </div>
          <Button size="lg" className="ayur-button-hero px-8" onClick={startQuiz}>
            Begin Analysis →
          </Button>
        </div>
      ) : (
        <div className="ad-quiz-card mx-auto max-w-2xl">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Question {currentQuestion + 1} of {quizQuestions.length}</span>
              <span>{Math.round(((currentQuestion + 1) / quizQuestions.length) * 100)}%</span>
            </div>
            <div className="w-full bg-primary/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          <h3 className="font-playfair text-2xl font-bold text-primary mb-6 text-center">
            {currentQ.question}
          </h3>

          <div className="space-y-3">
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                className="w-full ad-option-btn text-left"
                onClick={() => handleAnswer(option.value)}
                disabled={loading}
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

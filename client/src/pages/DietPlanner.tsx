import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import './DietPlanner.css';

gsap.registerPlugin(ScrollTrigger);

const DietPlanner = () => {
  const [step, setStep] = useState(1);
  const [dosha, setDosha] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [showDictionary, setShowDictionary] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const allergyOptions = ['ग्लूटेन', 'डेयरी', 'नट्स', 'शेलफिश', 'अंडे', 'सोया', 'मछली', 'गेहूं', 'मक्का', 'नाइटशेड', 'कोई नहीं'];
  const preferenceOptions = ['शाकाहारी', 'वीगन', 'मांसाहारी', 'लो-कार्ब', 'हाई-प्रोटीन', 'हल्का भोजन', 'भरपूर भोजन', 'मसालेदार भोजन', 'हल्का मसालेदार भोजन', 'कच्चा भोजन', 'पका हुआ भोजन'];

  const ayurvedicDictionary = [
    { term: 'दोष', definition: 'तीन मौलिक ऊर्जाएं जो हमारे आंतरिक और बाहरी वातावरण को नियंत्रित करती हैं: वात, पित्त और कफ।' },
    { term: 'वात', definition: 'गति की ऊर्जा, जो आकाश और वायु से बनी होती है।' },
    { term: 'पित्त', definition: 'पाचन या चयापचय की ऊर्जा, जो अग्नि और जल से बनी होती है।' },
    { term: 'कफ', definition: 'शरीर की संरचना बनाने वाली ऊर्जा, जो पृथ्वी और जल से बनी होती है।' },
    { term: 'अग्नि', definition: 'पाचन अग्नि; शरीर की चयापचय प्रक्रियाएं जो भोजन को ऊर्जा में परिवर्तित करती हैं।' },
    { term: 'आम', definition: 'अनुचित पाचन के कारण विषाक्त अपशिष्ट पदार्थों का संचय।' },
  ];

  const dietPlans: Record<string, any> = {
    vata: {
      description: "वात ठंडा, हल्का, अनियमित, शुष्क और हमेशा बदलता रहता है। वात को संतुलित करने के लिए गर्म, भारी और तैलीय विकल्प चुनें।",
      meals: {
        breakfast: { time: "7:00 - 8:00 AM", name: "गर्म मसालेदार दलिया", description: "घी, दालचीनी, इलायची के साथ पकाए गए ओट्स", image: "https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg" },
        lunch: { time: "12:00 - 1:00 PM", name: "पौष्टिक सब्जी स्ट्यू", description: "हल्दी और अदरक के साथ नारियल के दूध के शोरबा में उबली हुई जड़ वाली सब्जियां", image: "https://images.pexels.com/photos/539451/pexels-photo-539451.jpeg" },
        dinner: { time: "6:00 - 7:00 PM", name: "क्रीमी दाल सूप", description: "पालक, जीरा और धनिया के साथ पकी हुई मसूर की दाल", image: "https://images.pexels.com/photos/539451/pexels-photo-539451.jpeg" }
      },
      snacks: [
        { time: "10:00 AM", name: "गर्म मसालेदार दूध", description: "हल्दी, अदरक और शहद के साथ गर्म दूध" },
        { time: "4:00 PM", name: "खजूर और नट बॉल्स", description: "नारियल में लिपटे अखरोट के साथ खजूर" }
      ],
      exercises: [
        { name: "हल्का योग", description: "धीमी, जमीन से जुड़े आसन", image: "https://images.pexels.com/photos/1812964/pexels-photo-1812964.jpeg" }
      ]
    },
    pitta: {
      description: "पित्त गर्म, तेज, हल्का और तैलीय होता है। पित्त को संतुलित करने के लिए ठंडा, ताज़ा और मध्यम भारी विकल्प चुनें।",
      meals: {
        breakfast: { time: "7:00 - 8:00 AM", name: "ठंडा नारियल चिया पुडिंग", description: "नारियल के दूध में भीगे चिया बीज", image: "https://images.pexels.com/photos/5946772/pexels-photo-5946772.jpeg" },
        lunch: { time: "12:00 - 1:00 PM", name: "ताज़ा ककड़ी का सलाद", description: "ककड़ी, पुदीना, फेटा चीज", image: "https://images.pexels.com/photos/2862154/pexels-photo-2862154.jpeg" },
        dinner: { time: "6:00 - 7:00 PM", name: "मूंग दाल करी", description: "ठंडे मसालों के साथ पकी हुई मूंग दाल", image: "https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg" }
      },
      snacks: [
        { time: "10:00 AM", name: "मीठा मौसमी फल", description: "पका हुआ तरबूज, अंगूर" },
        { time: "4:00 PM", name: "ककड़ी पुदीना स्मूदी", description: "पुदीने की पत्तियों के साथ मिश्रित ककड़ी" }
      ],
      exercises: [
        { name: "तैराकी", description: "पित्त की गर्मी को कम करने वाला ठंडा व्यायाम", image: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg" }
      ]
    },
    kapha: {
      description: "कफ भारी, धीमा, ठंडा, तैलीय और चिकना होता है। कफ को संतुलित करने के लिए हल्के, शुष्क और गर्म विकल्प चुनें।",
      meals: {
        breakfast: { time: "7:00 - 8:00 AM", name: "मसालेदार सेब की कम्पोट", description: "अदरक, दालचीनी और लौंग के साथ उबले हुए सेब", image: "https://images.pexels.com/photos/6168330/pexels-photo-6168330.jpeg" },
        lunch: { time: "12:00 - 1:00 PM", name: "दाल और सब्जी का सूप", description: "काली मिर्च जैसे तीखे मसालों के साथ हल्का शोरबा", image: "https://images.pexels.com/photos/539451/pexels-photo-539451.jpeg" },
        dinner: { time: "6:00 - 7:00 PM", name: "क्विनोआ के साथ भुनी हुई सब्जियां", description: "देवदार और अजवायन के साथ भुनी हुई मिश्रित सब्जियां", image: "https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg" }
      },
      snacks: [
        { time: "10:00 AM", name: "मसालेदार चाय", description: "दालचीनी और काली मिर्च के साथ अदरक की चाय" },
        { time: "4:00 PM", name: "भुने हुए चने", description: "जीरा और हल्दी के साथ भुने हुए चने" }
      ],
      exercises: [
        { name: "जोरदार योग", description: "अष्टांग या पावर योग", image: "https://images.pexels.com/photos/1812964/pexels-photo-1812964.jpeg" }
      ]
    }
  };

  const handleAllergyChange = (allergy: string) => {
    if (allergy === 'कोई नहीं') {
      setAllergies(['कोई नहीं']);
    } else if (allergies.includes('कोई नहीं')) {
      setAllergies([allergy]);
    } else if (allergies.includes(allergy)) {
      setAllergies(allergies.filter(a => a !== allergy));
    } else {
      setAllergies([...allergies, allergy]);
    }
  };

  const handlePreferenceChange = (preference: string) => {
    if (foodPreferences.includes(preference)) {
      setFoodPreferences(foodPreferences.filter(p => p !== preference));
    } else {
      setFoodPreferences([...foodPreferences, preference]);
    }
  };

  const generateDietPlan = () => {
    if (dosha) {
      setDietPlan(dietPlans[dosha]);
      setStep(4);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length > 1) {
      const results = ayurvedicDictionary.filter(item => 
        item.term.toLowerCase().includes(term.toLowerCase()) || 
        item.definition.toLowerCase().includes(term.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  useEffect(() => {
    gsap.fromTo(".diet-planner-card", 
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: "back.out(1.2)" }
    );
  }, [step]);

  useEffect(() => {
    if (dietPlan) {
      gsap.fromTo(".meal-card, .exercise-card", 
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.8, stagger: 0.15, ease: "back.out(1.2)" }
      );
    }
  }, [dietPlan]);

  return (
    <div className="diet-planner-container" ref={containerRef}>
      <div className="diet-planner-background">
        <div className="diet-bg-element-1">🍃</div>
        <div className="diet-bg-element-2">🌿</div>
        <div className="diet-bg-element-3">🍂</div>
        <div className="diet-bg-element-4">🌸</div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="text-white hover:text-ayur-soft-gold transition-colors flex items-center">
          ← Back
        </button>
      </div>

      <div className="diet-planner-header">
        <h2>आयुर्वेदिक आहार योजनाकार</h2>
        <p>अपने दोष के अनुसार व्यक्तिगत आहार और व्यायाम योजना प्राप्त करें</p>
      </div>

      <div className="diet-progress">
        <div className="diet-progress-steps">
          <div className={`diet-step ${step >= 1 ? 'active' : ''}`}><span>1</span><p>दोष चुनें</p></div>
          <div className={`diet-step ${step >= 2 ? 'active' : ''}`}><span>2</span><p>एलर्जी</p></div>
          <div className={`diet-step ${step >= 3 ? 'active' : ''}`}><span>3</span><p>वरीयताएं</p></div>
          <div className={`diet-step ${step >= 4 ? 'active' : ''}`}><span>4</span><p>योजना</p></div>
        </div>
      </div>

      {step === 1 && (
        <div className="diet-planner-card">
          <h3>अपना प्रमुख दोष चुनें</h3>
          <p>आयुर्वेद के अनुसार, आपकी शारीरिक संरचना और स्वभाव को निर्धारित करने वाली ऊर्जा</p>
          <div className="dosha-selection">
            <div className={`dosha-option ${dosha === 'vata' ? 'selected' : ''}`} onClick={() => setDosha('vata')}>
              <div className="dosha-icon">💨</div>
              <h4>वात</h4>
              <p>गति, रचनात्मकता, परिवर्तनशीलता</p>
            </div>
            <div className={`dosha-option ${dosha === 'pitta' ? 'selected' : ''}`} onClick={() => setDosha('pitta')}>
              <div className="dosha-icon">🔥</div>
              <h4>पित्त</h4>
              <p>पाचन, बुद्धि, नेतृत्व</p>
            </div>
            <div className={`dosha-option ${dosha === 'kapha' ? 'selected' : ''}`} onClick={() => setDosha('kapha')}>
              <div className="dosha-icon">💧</div>
              <h4>कफ</h4>
              <p>स्थिरता, सहनशीलता, शक्ति</p>
            </div>
          </div>
          <button className="diet-next-button" onClick={() => setStep(2)} disabled={!dosha}>अगला कदम</button>
        </div>
      )}

      {step === 2 && (
        <div className="diet-planner-card">
          <h3>किसी भी एलर्जी का चयन करें</h3>
          <p>हम आपकी एलर्जी के अनुसार आहार योजना को अनुकूलित करेंगे</p>
          <div className="allergy-selection">
            {allergyOptions.map((allergy, index) => (
              <div key={index} className={`allergy-option ${allergies.includes(allergy) ? 'selected' : ''}`} onClick={() => handleAllergyChange(allergy)}>
                {allergy}
              </div>
            ))}
          </div>
          <div className="diet-navigation">
            <button className="diet-back-button" onClick={() => setStep(1)}>पिछला</button>
            <button className="diet-next-button" onClick={() => setStep(3)}>अगला कदम</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="diet-planner-card">
          <h3>अपनी भोजन वरीयताएं चुनें</h3>
          <p>हम आपकी पसंद के अनुसार आहार योजना को अनुकूलित करेंगे</p>
          <div className="preference-selection">
            {preferenceOptions.map((preference, index) => (
              <div key={index} className={`preference-option ${foodPreferences.includes(preference) ? 'selected' : ''}`} onClick={() => handlePreferenceChange(preference)}>
                {preference}
              </div>
            ))}
          </div>
          <div className="diet-navigation">
            <button className="diet-back-button" onClick={() => setStep(2)}>पिछला</button>
            <button className="diet-next-button" onClick={generateDietPlan}>आहार योजना बनाएं</button>
          </div>
        </div>
      )}

      {step === 4 && dietPlan && (
        <div className="diet-plan-container">
          <div className="diet-plan-header">
            <h3>आपकी व्यक्तिगत आयुर्वेदिक आहार योजना</h3>
            <p>{dietPlan.description}</p>
          </div>
          
          <div className="meals-section">
            <h4>दैनिक भोजन योजना</h4>
            <div className="meal-cards">
              <div className="meal-card">
                <div className="meal-image" style={{backgroundImage: `url(${dietPlan.meals.breakfast.image})`}}></div>
                <div className="meal-content">
                  <span className="meal-time">{dietPlan.meals.breakfast.time}</span>
                  <h5>{dietPlan.meals.breakfast.name}</h5>
                  <p>{dietPlan.meals.breakfast.description}</p>
                </div>
              </div>
              <div className="meal-card">
                <div className="meal-image" style={{backgroundImage: `url(${dietPlan.meals.lunch.image})`}}></div>
                <div className="meal-content">
                  <span className="meal-time">{dietPlan.meals.lunch.time}</span>
                  <h5>{dietPlan.meals.lunch.name}</h5>
                  <p>{dietPlan.meals.lunch.description}</p>
                </div>
              </div>
              <div className="meal-card">
                <div className="meal-image" style={{backgroundImage: `url(${dietPlan.meals.dinner.image})`}}></div>
                <div className="meal-content">
                  <span className="meal-time">{dietPlan.meals.dinner.time}</span>
                  <h5>{dietPlan.meals.dinner.name}</h5>
                  <p>{dietPlan.meals.dinner.description}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="snacks-section">
            <h4>नाश्ते का समय</h4>
            <div className="snack-cards">
              {dietPlan.snacks.map((snack: any, index: number) => (
                <div key={index} className="snack-card">
                  <span className="snack-time">{snack.time}</span>
                  <h5>{snack.name}</h5>
                  <p>{snack.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="exercises-section">
            <h4>अनुशंसित व्यायाम</h4>
            <div className="exercise-cards">
              {dietPlan.exercises.map((exercise: any, index: number) => (
                <div key={index} className="exercise-card">
                  <div className="exercise-image" style={{backgroundImage: `url(${exercise.image})`}}></div>
                  <div className="exercise-content">
                    <h5>{exercise.name}</h5>
                    <p>{exercise.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="diet-navigation">
            <button className="diet-back-button" onClick={() => setStep(3)}>वापस जाएं</button>
            <button className="diet-restart-button" onClick={() => { setStep(1); setDosha(''); setAllergies([]); setFoodPreferences([]); setDietPlan(null); }}>
              नई योजना बनाएं
            </button>
          </div>
        </div>
      )}

      <div className="dictionary-section">
        <button className="dictionary-toggle" onClick={() => setShowDictionary(!showDictionary)}>
          {showDictionary ? 'आयुर्वेद शब्दकोश छुपाएं' : 'आयुर्वेद शब्दकोश देखें'}
        </button>
        {showDictionary && (
          <div className="dictionary-card">
            <h3>आयुर्वेद शब्दकोश</h3>
            <div className="search-container">
              <input type="text" placeholder="आयुर्वेदिक शब्द खोजें..." value={searchTerm} onChange={handleSearch} />
            </div>
            <div className="dictionary-results">
              {searchResults.length > 0 ? (
                searchResults.map((item, index) => (
                  <div key={index} className="dictionary-item"><h4>{item.term}</h4><p>{item.definition}</p></div>
                ))
              ) : searchTerm.length > 1 ? (
                <p className="no-results">कोई परिणाम नहीं मिला</p>
              ) : (
                ayurvedicDictionary.map((item, index) => (
                  <div key={index} className="dictionary-item"><h4>{item.term}</h4><p>{item.definition}</p></div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DietPlanner;

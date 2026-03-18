import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import './HerbalRemedies.css';

gsap.registerPlugin(ScrollTrigger);

const HerbalRemedies = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [dictionaryTerm, setDictionaryTerm] = useState('');
  const [dictionaryResults, setDictionaryResults] = useState<any>(null);
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const containerRef = useRef<HTMLDivElement>(null);
  const herbRainRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const commonDiseases = [
    { id: 1, en: 'Common Cold', hi: 'सामान्य सर्दी-जुकाम' },
    { id: 2, en: 'Headache', hi: 'सिरदर्द' },
    { id: 3, en: 'Indigestion', hi: 'अपच' },
    { id: 4, en: 'Insomnia', hi: 'अनिद्रा' },
    { id: 5, en: 'Stress', hi: 'तनाव' },
    { id: 6, en: 'Arthritis', hi: 'गठिया' },
    { id: 7, en: 'Diabetes', hi: 'मधुमेह' },
    { id: 8, en: 'High Blood Pressure', hi: 'उच्च रक्तचाप' },
    { id: 9, en: 'Skin Problems', hi: 'त्वचा संबंधी समस्याएं' },
    { id: 10, en: 'Allergies', hi: 'एलर्जी' }
  ];

  const commonAllergies = [
    { id: 1, en: 'Gluten', hi: 'ग्लूटेन' },
    { id: 2, en: 'Dairy', hi: 'डेयरी' },
    { id: 3, en: 'Nuts', hi: 'नट्स' },
    { id: 4, en: 'Shellfish', hi: 'शेलफिश' },
    { id: 5, en: 'Eggs', hi: 'अंडे' },
    { id: 6, en: 'Soy', hi: 'सोया' }
  ];

  const herbalDatabase: Record<string, any> = {
    'Common Cold': {
      treatment: { en: 'A combination of ginger, tulsi, and black pepper tea', hi: 'अदरक, तुलसी और काली मिर्च की चाय का संयोजन' },
      remedies: [
        { en: 'Tulsi Tea with Ginger and Honey', hi: 'अदरक और शहद के साथ तुलसी की चाय' },
        { en: 'Turmeric Milk with Black Pepper', hi: 'काली मिर्च के साथ हल्दी वाला दूध' },
        { en: 'Steam Inhalation with Eucalyptus Oil', hi: 'नीलगिरी तेल के साथ भाप की साँस लेना' }
      ],
      herbs: [
        { en: 'Tulsi (Holy Basil)', hi: 'तुलसी', benefits: { en: 'Boosts immunity', hi: 'प्रतिरक्षा बढ़ाता है' } },
        { en: 'Ginger', hi: 'अदरक', benefits: { en: 'Reduces inflammation', hi: 'सूजन कम करता है' } }
      ],
      lifestyle: [{ en: 'Get plenty of rest', hi: 'भरपूर आराम लें' }]
    },
    'Headache': {
      treatment: { en: 'Application of peppermint oil on temples', hi: 'मंदिरों और माथे पर पुदीना तेल का अनुप्रयोग' },
      remedies: [
        { en: 'Peppermint or Eucalyptus Oil Massage', hi: 'पुदीना या नीलगिरी तेल की मालिश' },
        { en: 'Ginger and Lemon Tea', hi: 'अदरक और नींबू की चाय' }
      ],
      herbs: [
        { en: 'Peppermint', hi: 'पुदीना', benefits: { en: 'Cooling effect', hi: 'ठंडा प्रभाव' } }
      ],
      lifestyle: [{ en: 'Practice relaxation techniques', hi: 'विश्राम तकनीकों का अभ्यास करें' }]
    },
    'Indigestion': {
      treatment: { en: 'A combination of ginger, fennel, and coriander tea', hi: 'अदरक, सौंफ और धनिया की चाय का संयोजन' },
      remedies: [{ en: 'Ginger Tea with Lemon', hi: 'नींबू के साथ अदरक की चाय' }, { en: 'Fennel Seed Infusion', hi: 'सौंफ के बीज का काढ़ा' }],
      herbs: [{ en: 'Ginger', hi: 'अदरक', benefits: { en: 'Aids digestion', hi: 'पाचन में सहायता' } }],
      lifestyle: [{ en: 'Eat smaller, more frequent meals', hi: 'छोटे, अधिक बार भोजन करें' }]
    }
  };

  const plantDictionary: Record<string, any> = {
    'tulsi': {
      name: { en: 'Tulsi (Holy Basil)', hi: 'तुलसी' },
      description: { en: 'Tulsi is considered sacred in Ayurveda.', hi: 'तुलसी को आयुर्वेद में पवित्र माना जाता है।' },
      uses: { en: ['Immunity boosting', 'Respiratory health'], hi: ['प्रतिरक्षा बढ़ाना', 'श्वसन स्वास्थ्य'] },
      image: 'https://images.pexels.com/photos/6858623/pexels-photo-6858623.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    'turmeric': {
      name: { en: 'Turmeric', hi: 'हल्दी' },
      description: { en: 'Turmeric contains curcumin, a compound with powerful anti-inflammatory properties.', hi: 'हल्दी में करक्यूमिन होता है।' },
      uses: { en: ['Anti-inflammatory', 'Antioxidant'], hi: ['विरोधी भड़काऊ', 'एंटीऑक्सीडेंट'] },
      image: 'https://images.pexels.com/photos/5946738/pexels-photo-5946738.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  };

  const triggerHerbRain = () => {
    const herbs = herbRainRef.current?.children;
    if (herbs) {
      gsap.set(herbs, { y: -100, opacity: 0, rotation: -15 });
      gsap.to(herbs, {
        y: '+=300', opacity: 1, rotation: 15, duration: 2, stagger: 0.1, ease: "power1.out",
        onComplete: () => { gsap.to(herbs, { opacity: 0, duration: 1 }); }
      });
    }
  };

  const handleSearch = () => {
    if (selectedDisease && herbalDatabase[selectedDisease]) {
      setShowResults(true);
      triggerHerbRain();
      setTimeout(() => {
        gsap.fromTo(".hr-result-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: "back.out(1.2)" });
      }, 300);
    } else {
      gsap.fromTo(".hr-search-card", { x: 0 }, { x: 10, duration: 0.1, repeat: 3, yoyo: true, ease: "power1.inOut" });
    }
  };

  const handleDictionarySearch = () => {
    const term = dictionaryTerm.toLowerCase();
    if (plantDictionary[term]) {
      setDictionaryResults(plantDictionary[term]);
      triggerHerbRain();
      gsap.fromTo(".hr-dictionary-result", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.2)" });
    } else {
      setDictionaryResults(null);
    }
  };

  useEffect(() => {
    gsap.fromTo(".hr-section-title", { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.2 });
    gsap.fromTo(".hr-search-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.4, ease: "power2.out" });
    gsap.fromTo(".hr-feature-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, delay: 0.6 });

    gsap.to(".hr-search-card", {
      boxShadow: "0 5px 15px rgba(88, 129, 87, 0.3)",
      duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut"
    });

    gsap.utils.toArray('.hr-animate-on-scroll').forEach(element => {
      gsap.fromTo(element as Element, { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, duration: 1,
        scrollTrigger: { trigger: element as Element, start: "top 80%", toggleActions: "play none none none" }
      });
    });
  }, []);

  const getText = (text: any) => {
    if (!text) return '';
    return text[language] || text.en || text;
  };

  return (
    <div className="hr-container" ref={containerRef}>
      <div className="hr-background">
        <div className="hr-background-image"></div>
        <div className="hr-background-overlay"></div>
        <div className="hr-background-element hr-bg-element-1">🌿</div>
        <div className="hr-background-element hr-bg-element-2">✨</div>
        <div className="hr-background-element hr-bg-element-3">🌸</div>
        <div className="hr-background-element hr-bg-element-4">🍃</div>
        <div className="hr-herb-rain" ref={herbRainRef}>
          {Array.from({ length: 20 }).map((_, i) => <div key={i} className="hr-herb">🌿</div>)}
        </div>
      </div>

      <div className="px-6 pt-6 relative z-10 flex justify-between items-center w-full">
        <button onClick={() => navigate(-1)} className="text-white hover:text-ayur-soft-gold transition-colors flex items-center">
          ← Back
        </button>

        <div className="flex gap-2">
          <button className={`hr-lang-btn ${language === 'english' ? 'active' : ''}`} onClick={() => setLanguage('english')}>EN</button>
          <button className={`hr-lang-btn ${language === 'hindi' ? 'active' : ''}`} onClick={() => setLanguage('hindi')}>HI</button>
        </div>
      </div>

      <div className="hr-header">
        <h2 className="hr-section-title">{language === 'english' ? 'Herbal Remedies' : 'जड़ी बूटी उपचार'}</h2>
        <p className="hr-tagline">{language === 'english' ? 'Discover natural Ayurvedic solutions for common health concerns' : 'सामान्य स्वास्थ्य चिंताओं के लिए प्राकृतिक आयुर्वेदिक समाधान खोजें'}</p>
      </div>

      <div className="hr-content">
        <div className="hr-search-section hr-animate-on-scroll">
          <div className="hr-search-card text-left">
            <h3>{language === 'english' ? 'Find Ayurvedic Remedies' : 'आयुर्वेदिक उपचार खोजें'}</h3>
            <div className="hr-search-input">
              <label>{language === 'english' ? 'Select a health concern' : 'एक स्वास्थ्य चिंता चुनें'}</label>
              <select value={selectedDisease} onChange={(e) => setSelectedDisease(e.target.value)}>
                <option value="">{language === 'english' ? '-- Select a condition --' : '-- एक स्थिति चुनें --'}</option>
                {commonDiseases.map(disease => (
                  <option key={disease.id} value={disease.en}>{language === 'english' ? disease.en : disease.hi}</option>
                ))}
              </select>
            </div>
            <div className="hr-search-input">
              <label>{language === 'english' ? 'Any allergies? (Select multiple)' : 'कोई एलर्जी? (कई चुनें)'}</label>
              <select multiple value={allergies} onChange={(e) => {
                  const options = [...e.target.options];
                  const selected = options.filter(o => o.selected).map(o => o.value);
                  setAllergies(selected);
                }}>
                {commonAllergies.map(allergy => (
                  <option key={allergy.id} value={allergy.en}>{language === 'english' ? allergy.en : allergy.hi}</option>
                ))}
              </select>
              <small>{language === 'english' ? 'Hold Ctrl/Cmd to select multiple' : 'कई चयन करने के लिए Ctrl/Cmd दबाए रखें'}</small>
            </div>
            <button className="hr-search-btn" onClick={handleSearch}>{language === 'english' ? 'Find Remedies' : 'उपचार खोजें'}</button>
          </div>
        </div>

        {showResults && herbalDatabase[selectedDisease] && (
          <div className="hr-results-section hr-animate-on-scroll">
            <h3>{language === 'english' ? `Ayurvedic Remedies for ${selectedDisease}` : `${selectedDisease} के लिए आयुर्वेदिक उपचार`}</h3>
            <div className="hr-results-grid">
              <div className="hr-result-card text-left">
                <div className="hr-card-icon">🌿</div>
                <h4>{language === 'english' ? 'Recommended Treatment' : 'अनुशंसित उपचार'}</h4>
                <p>{getText(herbalDatabase[selectedDisease].treatment)}</p>
              </div>
              <div className="hr-result-card text-left">
                <div className="hr-card-icon">💡</div>
                <h4>{language === 'english' ? 'Specific Remedies' : 'विशिष्ट उपचार'}</h4>
                <ul className="list-disc ml-5">
                  {herbalDatabase[selectedDisease].remedies.map((remedy: any, idx: number) => <li key={idx}>{getText(remedy)}</li>)}
                </ul>
              </div>
              <div className="hr-result-card text-left">
                <div className="hr-card-icon">🌱</div>
                <h4>{language === 'english' ? 'Beneficial Herbs' : 'लाभकारी जड़ी बूटियाँ'}</h4>
                <div className="hr-herbs-list">
                  {herbalDatabase[selectedDisease].herbs.map((herb: any, idx: number) => (
                    <div key={idx} className="hr-herb-item mb-2">
                      <span className="hr-herb-name text-primary block">{language === 'english' ? herb.en : herb.hi}</span>
                      <span className="hr-herb-benefits text-sm text-gray-700 block">{getText(herb.benefits)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hr-result-card text-left">
                <div className="hr-card-icon">🧘</div>
                <h4>{language === 'english' ? 'Lifestyle Recommendations' : 'जीवनशैली की सिफारिशें'}</h4>
                <ul className="list-disc ml-5">
                  {herbalDatabase[selectedDisease].lifestyle.map((tip: any, idx: number) => <li key={idx}>{getText(tip)}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="hr-dictionary-section hr-animate-on-scroll mt-12">
          <h3>{language === 'english' ? 'Ayurvedic Plant Dictionary' : 'आयुर्वेदिक पौधा शब्दकोश'}</h3>
          <div className="hr-dictionary-card text-left">
            <div className="hr-dictionary-search">
              <input type="text" placeholder={language === 'english' ? 'Search for plants (e.g., tulsi, turmeric)' : 'पौधों की खोज करें (जैसे, तुलसी, हल्दी)'}
                value={dictionaryTerm} onChange={(e) => setDictionaryTerm(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleDictionarySearch()} />
              <button onClick={handleDictionarySearch}>{language === 'english' ? 'Search' : 'खोजें'}</button>
            </div>
            {dictionaryResults && (
              <div className="hr-dictionary-result">
                <div className="hr-plant-header">
                  <h4>{getText(dictionaryResults.name)}</h4>
                  <div className="hr-plant-image" style={{ backgroundImage: `url(${dictionaryResults.image})` }}></div>
                </div>
                <div className="hr-plant-details">
                  <p>{getText(dictionaryResults.description)}</p>
                  <h5 className="mt-4 mb-2 font-bold">{language === 'english' ? 'Common Uses:' : 'सामान्य उपयोग:'}</h5>
                  <ul className="list-disc ml-5 mb-4">
                    {dictionaryResults.uses[language]?.map((use: any, index: number) => <li key={index}>{use}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HerbalRemedies;

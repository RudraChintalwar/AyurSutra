import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

// Assets
import ayurvedaImage from '@/assets/ayurveda-hero.jpg';
import yogaPose from '@/assets/yoga-figure.png';
import aiayurveda from '@/assets/aiayurveda.png';
import './Landing.css';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

const Landing = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tx = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const testimonialsRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);
  const yogaFigureRef = useRef<HTMLDivElement>(null);
  const herbsContainerRef = useRef<HTMLDivElement>(null);

  // GSAP Animations
  useEffect(() => {
    const yogaEl = yogaFigureRef.current;

    // Header animations
    if (logoRef.current) {
      gsap.fromTo(logoRef.current, 
        { opacity: 0, y: -50 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
      );
    }

    if (navRef.current) {
      gsap.fromTo(navRef.current.children, 
        { opacity: 0, y: -30 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: "power2.out", delay: 0.5 }
      );
    }

    // Hero content animations
    if (heroContentRef.current) {
      gsap.fromTo(heroContentRef.current.children, 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.5, stagger: 0.3, ease: "power3.out", delay: 1 }
      );
    }

    // 🌿 Yoga figure default breathing animation
    if (yogaEl) {
      gsap.to(yogaEl, {
        y: 10,
        scale: 1.01,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      // ✨ Hover effect
      const hoverIn = () => {
        gsap.to(yogaEl, {
          scale: 1.1,
          rotation: 5,
          duration: 0.6,
          ease: "power2.out"
        });
      };

      const hoverOut = () => {
        gsap.to(yogaEl, {
          scale: 1.01,
          rotation: 0,
          duration: 0.8,
          ease: "power2.inOut"
        });
      };

      yogaEl.addEventListener("mouseenter", hoverIn);
      yogaEl.addEventListener("mouseleave", hoverOut);

      return () => {
        yogaEl.removeEventListener("mouseenter", hoverIn);
        yogaEl.removeEventListener("mouseleave", hoverOut);
      };
    }
  }, []);

  useEffect(() => {
    // Herb mixing animation
    if (herbsContainerRef.current) {
      const herbs = herbsContainerRef.current.children;
      gsap.to(herbs, {
        y: -100,
        rotation: 360,
        duration: 4,
        stagger: 0.2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
      });
    }

    // Section animations
    const sections = [aboutRef, servicesRef, featuresRef, testimonialsRef, contactRef];
    sections.forEach(section => {
      if (section.current) {
        gsap.fromTo(section.current, 
          { opacity: 0, y: 100 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            scrollTrigger: {
              trigger: section.current,
              start: "top 80%",
              toggleActions: "play none none reverse"
            }
          }
        );
      }
    });

    // Service cards animation
    gsap.fromTo(".ayur-service-card", 
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".ayur-services-grid",
          start: "top 70%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Feature items animation
    gsap.fromTo(".ayur-feature-item", 
      { opacity: 0, x: -50 },
      {
        opacity: 1,
        x: 0,
        duration: 0.8,
        stagger: 0.15,
        scrollTrigger: {
          trigger: ".ayur-features-grid",
          start: "top 70%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Happy people animation
    gsap.fromTo(".ayur-happy-person", 
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1,
        duration: 1,
        stagger: 0.3,
        scrollTrigger: {
          trigger: ".ayur-testimonials-grid",
          start: "top 70%",
          toggleActions: "play none none reverse"
        }
      }
    );

  }, []);

  return (
    <div className="ayursutra">
      {/* Header Section */}
      <header ref={headerRef} className="ayur-header">
        <div className="ayur-herbal-overlay"></div>
        <div className="ayur-container">
          <nav className="ayur-nav-container">
            <div ref={logoRef} className="ayur-logo font-playfair bg-clip-text text-transparent bg-gradient-to-r from-emerald-100 to-amber-100 font-bold">
              <span className="ayur-logo-icon">🌿</span>
              AYURSUTRA
            </div>
            <ul ref={navRef} className="ayur-nav-links">
              <li><a href="#about">{tx('About', 'हमारे बारे में')}</a></li>
              <li><a href="#services">{tx('Services', 'सेवाएं')}</a></li>
              <li><a href="#features">{tx('Features', 'विशेषताएं')}</a></li>
              <li><a href="#testimonials">{tx('Testimonials', 'प्रशंसापत्र')}</a></li>
              <li><button onClick={() => navigate('/login')} className="font-semibold text-amber-300 hover:text-white transition-colors duration-200">{tx('Sign In', 'साइन इन')}</button></li>
            </ul>
          </nav>
        </div>
        <div ref={heroContentRef} className="ayur-hero-content">
          <h1>{tx('AI-Enhanced Ayurvedic Healing Journey', 'AI-सक्षम आयुर्वेदिक हीलिंग यात्रा')}</h1>
          <p>{tx('Revolutionizing Panchakarma Therapy with Intelligent Technology', 'बुद्धिमान तकनीक के साथ पंचकर्म थेरेपी में क्रांति')}</p>
          <a className="ayur-cta-button" onClick={(e) => navigate("/login")}>{tx('Get Started', 'शुरू करें')}</a>
        </div>
        
        {/* 3D Yoga Figure */}
        <div ref={yogaFigureRef} className="ayur-yoga-figure">
          <img src={yogaPose} alt="Yoga Pose" />
        </div>
        
        {/* Herb Mixing Animation */}
        <div ref={herbsContainerRef} className="ayur-herbs-container">
          <div className="ayur-herb">🌿</div>
          <div className="ayur-herb">🍃</div>
          <div className="ayur-herb">🌱</div>
          <div className="ayur-herb">☘️</div>
        </div>
        
        <div className="ayur-powder-effect">
          <div className="ayur-powder-particle"></div>
          <div className="ayur-powder-particle"></div>
          <div className="ayur-powder-particle"></div>
        </div>
      </header>

      {/* About Section */}
      <section ref={aboutRef} id="about" className="ayur-about">
        <div className="ayur-container">
          <div className="ayur-about-content">
            <div className="ayur-about-text">
              <h2>{tx('Transforming Ayurvedic Healing', 'आयुर्वेदिक उपचार को रूपांतरित करना')}</h2>
              <p>{tx('AyurSutra seamlessly blends ancient Ayurvedic wisdom with cutting-edge AI technology to deliver personalized Panchakarma therapy management. Our platform empowers clinics and practitioners to provide exceptional care while optimizing operations.', 'AyurSutra प्राचीन आयुर्वेदिक ज्ञान को आधुनिक AI तकनीक के साथ जोड़कर व्यक्तिगत पंचकर्म प्रबंधन प्रदान करता है। हमारा प्लेटफॉर्म क्लिनिक और चिकित्सकों को बेहतर देखभाल और संचालन दक्षता देता है।')}</p>
              <p>{tx("With the global Ayurvedic market projected to reach $16 billion by 2026, there's never been a better time to modernize your practice with intelligent solutions that honor tradition while embracing innovation.", 'वैश्विक आयुर्वेद बाज़ार के तेज़ी से बढ़ने के साथ, परंपरा का सम्मान करते हुए नवाचार अपनाने का यह सर्वोत्तम समय है।')}</p>
            </div>
            <div className="ayur-about-image">
              <img src={ayurvedaImage} alt="Ayurvedic herbs and ingredients" />
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section ref={servicesRef} id="services" className="ayur-services">
        <div className="ayur-container">
          <h2 className="ayur-section-title">{tx('Our Services', 'हमारी सेवाएं')}</h2>
          <div className="ayur-services-grid">
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=818&q=80" alt="Panchakarma Therapy" />
              </div>
              <h3>{tx('Panchakarma Therapy Management', 'पंचकर्म थेरेपी प्रबंधन')}</h3>
              <p>{tx('Comprehensive digital management of traditional detoxification and rejuvenation therapies.', 'पारंपरिक डिटॉक्स और पुनर्यौवन थेरेपी का समग्र डिजिटल प्रबंधन।')}</p>
            </div>
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src={aiayurveda} alt="AI Assessment" />
              </div>
              <h3>{tx('AI-Powered Patient Assessment', 'AI-संचालित रोगी मूल्यांकन')}</h3>
              <p>{tx('Advanced Dosha analysis and Prakriti classification using intelligent algorithms.', 'बुद्धिमान एल्गोरिदम द्वारा उन्नत दोष विश्लेषण और प्रकृति वर्गीकरण।')}</p>
            </div>
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src="https://imgs.search.brave.com/l822rCL6dzr35lS3bL4mNRqSG4UEUFBI4j5USJRdQz8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93d3cu/c2Ftd2FydGhpa2Eu/Y29tL2Jsb2cvaW1h/Z2VzL3VsdGltYXRl/LWd1aWRlLXRvLXBs/YW5uaW5nLWFuLWF5/dXJ2ZWRhLXdlbGxu/ZXNzLXJldHJlYXQu/d2VicA" alt="Treatment Planning" />
              </div>
              <h3>{tx('Personalized Treatment Plans', 'व्यक्तिगत उपचार योजनाएं')}</h3>
              <p>{tx('Custom therapy sequences and diet/lifestyle recommendations based on individual needs.', 'व्यक्तिगत आवश्यकताओं के अनुसार कस्टम थेरेपी अनुक्रम और आहार/जीवनशैली सुझाव।')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} id="features" className="ayur-features">
        <div className="ayur-container">
          <h2 className="ayur-section-title">{tx('Intelligent Features', 'स्मार्ट विशेषताएं')}</h2>
          <div className="ayur-features-grid">
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">⏱️</div>
              <h3>{tx('Priority Scheduling', 'प्राथमिकता शेड्यूलिंग')}</h3>
              <p>{tx('Auto-reschedules slots based on patient severity & urgency with intelligent algorithms.', 'रोगी की गंभीरता और तात्कालिकता के आधार पर स्लॉट का स्वचालित पुनःशेड्यूल।')}</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">🧠</div>
              <h3>{tx('AI Dosha & Prakriti Classifier', 'AI दोष और प्रकृति क्लासिफ़ायर')}</h3>
              <p>{tx('Detects imbalance & suggests personalized Panchakarma protocol with 95% accuracy.', 'असंतुलन का पता लगाकर 95% सटीकता से व्यक्तिगत पंचकर्म प्रोटोकॉल सुझाता है।')}</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">📅</div>
              <h3>{tx('Therapy Session Predictor', 'थेरेपी सत्र पूर्वानुमान')}</h3>
              <p>{tx('Estimates no. of sessions needed & pre-plans appointments for optimal results.', 'आवश्यक सत्रों का अनुमान लगाकर सर्वोत्तम परिणाम हेतु अपॉइंटमेंट पूर्व नियोजित करता है।')}</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">💬</div>
              <h3>{tx('Digital Vaidya Assistant', 'डिजिटल वैद्य सहायक')}</h3>
              <p>{tx('24/7 chatbot for Ayurvedic guidance & triage support with natural language processing.', 'आयुर्वेदिक मार्गदर्शन और ट्रायाज सहायता के लिए 24/7 चैटबॉट।')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={testimonialsRef} id="testimonials" className="ayur-testimonials">
        <div className="ayur-container">
          <h2 className="ayur-section-title">{tx('Happy Users', 'संतुष्ट उपयोगकर्ता')}</h2>
          <div className="ayur-testimonials-grid">
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">😊</div>
              <div className="ayur-testimonial-content">
                <p>{tx('"AyurSutra transformed our clinic operations. We\'ve reduced no-shows by 40% and increased patient satisfaction significantly."', '"AyurSutra ने हमारे क्लिनिक संचालन को बदल दिया। हमने नो-शो 40% घटाए और रोगी संतुष्टि बढ़ाई।"')}</p>
                <div className="ayur-testimonial-author">
                  <h4>Dr. Priya Sharma</h4>
                  <p>Director, Aarogya Ayurvedic Center</p>
                </div>
              </div>
            </div>
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">😄</div>
              <div className="ayur-testimonial-content">
                <p>{tx('"The AI-powered assessment accurately identified my Prakriti, and the personalized treatment plan has been life-changing."', '"AI-संचालित मूल्यांकन ने मेरी प्रकृति सही पहचानी और व्यक्तिगत योजना जीवन बदलने वाली रही।"')}</p>
                <div className="ayur-testimonial-author">
                  <h4>Rahul Mehta</h4>
                  <p>Patient for 6 months</p>
                </div>
              </div>
            </div>
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">🥰</div>
              <div className="ayur-testimonial-content">
                <p>{tx('"Implementing AyurSutra has allowed us to scale our services while maintaining the personalized touch that Ayurveda requires."', '"AyurSutra लागू करने से हम सेवाएं बढ़ा पाए और आयुर्वेद की व्यक्तिगत देखभाल भी बनाए रखी।"')}</p>
                <div className="ayur-testimonial-author">
                  <h4>Ananya Patel</h4>
                  <p>Clinic Manager, Sanjeevani Ayurveda</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section ref={contactRef} id="contact" className="ayur-contact">
        <div className="ayur-container">
          <div className="ayur-contact-content">
            <h2>{tx('Ready to Transform Your Ayurvedic Practice?', 'क्या आप अपनी आयुर्वेदिक प्रैक्टिस को बदलने के लिए तैयार हैं?')}</h2>
            <p>{tx('Join the revolution in Ayurvedic healthcare. Schedule a personalized demo to see how AyurSutra can elevate your clinic.', 'आयुर्वेदिक स्वास्थ्य क्रांति से जुड़ें। व्यक्तिगत डेमो बुक करें और देखें AyurSutra कैसे आपके क्लिनिक को बेहतर बनाता है।')}</p>
            <form className="ayur-contact-form">
              <div className="ayur-form-row">
                <div className="ayur-form-group">
                  <input type="text" placeholder={tx('Your Name', 'आपका नाम')} id="name" />
                </div>
                <div className="ayur-form-group">
                  <input type="email" placeholder={tx('Email Address', 'ईमेल पता')} id="email" />
                </div>
              </div>
              <div className="ayur-form-group ayur-full-width">
                <textarea placeholder={tx('Tell us about your requirements', 'अपनी आवश्यकताएं बताएं')} id="message" rows={4}></textarea>
              </div>
              <button type="submit" className="ayur-cta-button">{tx('Request a Demo', 'डेमो का अनुरोध करें')}</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ayur-footer">
        <div className="ayur-container">
          <div className="ayur-footer-content">
            <div className="ayur-footer-section">
              <div className="ayur-logo font-playfair bg-clip-text text-transparent bg-gradient-to-r from-emerald-100 to-amber-100 font-bold">
                <span className="ayur-logo-icon">🌿</span>
                AYURSUTRA
              </div>
              <p>{tx('Bridging Ancient Ayurvedic Wisdom with Modern Technology', 'प्राचीन आयुर्वेदिक ज्ञान और आधुनिक तकनीक के बीच सेतु')}</p>
            </div>
            <div className="ayur-footer-section">
              <h3>{tx('Quick Links', 'त्वरित लिंक')}</h3>
              <ul>
                <li><a href="#about">{tx('About Us', 'हमारे बारे में')}</a></li>
                <li><a href="#services">{tx('Services', 'सेवाएं')}</a></li>
                <li><a href="#features">{tx('Features', 'विशेषताएं')}</a></li>
                <li><a href="#contact">{tx('Contact', 'संपर्क')}</a></li>
              </ul>
            </div>
            <div className="ayur-footer-section">
              <h3>{tx('Contact Us', 'संपर्क करें')}</h3>
              <p>Email: info@ayursutra.com</p>
              <p>Phone: +91 98765 43210</p>
              <p>Address: Ayurveda Tech Park, Pune, Maharashtra</p>
            </div>
          </div>
          <div className="ayur-copyright">
            <p>{tx('© 2023 AyurSutra. All rights reserved.', '© 2023 AyurSutra. सर्वाधिकार सुरक्षित।')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';

// Assets
import ayurvedaImage from '@/assets/ayurveda-hero.jpg';
import yogaPose from '@/assets/yoga-figure.png';
import aiayurveda from '@/assets/aiayurveda.png';
import './Landing.css';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

const Landing = () => {
  const navigate = useNavigate();

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
              <li><a href="#about">About</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#testimonials">Testimonials</a></li>
              <li><button onClick={() => navigate('/login')} className="font-semibold text-amber-300 hover:text-white transition-colors duration-200">Sign In</button></li>
            </ul>
          </nav>
        </div>
        <div ref={heroContentRef} className="ayur-hero-content">
          <h1>AI-Enhanced Ayurvedic Healing Journey</h1>
          <p>Revolutionizing Panchakarma Therapy with Intelligent Technology</p>
          <a className="ayur-cta-button" onClick={(e) => navigate("/login")}>Get Started</a>
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
              <h2>Transforming Ayurvedic Healing</h2>
              <p>AyurSutra seamlessly blends ancient Ayurvedic wisdom with cutting-edge AI technology to deliver personalized Panchakarma therapy management. Our platform empowers clinics and practitioners to provide exceptional care while optimizing operations.</p>
              <p>With the global Ayurvedic market projected to reach $16 billion by 2026, there's never been a better time to modernize your practice with intelligent solutions that honor tradition while embracing innovation.</p>
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
          <h2 className="ayur-section-title">Our Services</h2>
          <div className="ayur-services-grid">
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=818&q=80" alt="Panchakarma Therapy" />
              </div>
              <h3>Panchakarma Therapy Management</h3>
              <p>Comprehensive digital management of traditional detoxification and rejuvenation therapies.</p>
            </div>
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src={aiayurveda} alt="AI Assessment" />
              </div>
              <h3>AI-Powered Patient Assessment</h3>
              <p>Advanced Dosha analysis and Prakriti classification using intelligent algorithms.</p>
            </div>
            <div className="ayur-service-card">
              <div className="ayur-service-icon">
                <img src="https://imgs.search.brave.com/l822rCL6dzr35lS3bL4mNRqSG4UEUFBI4j5USJRdQz8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93d3cu/c2Ftd2FydGhpa2Eu/Y29tL2Jsb2cvaW1h/Z2VzL3VsdGltYXRl/LWd1aWRlLXRvLXBs/YW5uaW5nLWFuLWF5/dXJ2ZWRhLXdlbGxu/ZXNzLXJldHJlYXQu/d2VicA" alt="Treatment Planning" />
              </div>
              <h3>Personalized Treatment Plans</h3>
              <p>Custom therapy sequences and diet/lifestyle recommendations based on individual needs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} id="features" className="ayur-features">
        <div className="ayur-container">
          <h2 className="ayur-section-title">Intelligent Features</h2>
          <div className="ayur-features-grid">
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">⏱️</div>
              <h3>Priority Scheduling</h3>
              <p>Auto-reschedules slots based on patient severity & urgency with intelligent algorithms.</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">🧠</div>
              <h3>AI Dosha & Prakriti Classifier</h3>
              <p>Detects imbalance & suggests personalized Panchakarma protocol with 95% accuracy.</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">📅</div>
              <h3>Therapy Session Predictor</h3>
              <p>Estimates no. of sessions needed & pre-plans appointments for optimal results.</p>
            </div>
            <div className="ayur-feature-item">
              <div className="ayur-feature-icon">💬</div>
              <h3>Digital Vaidya Assistant</h3>
              <p>24/7 chatbot for Ayurvedic guidance & triage support with natural language processing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={testimonialsRef} id="testimonials" className="ayur-testimonials">
        <div className="ayur-container">
          <h2 className="ayur-section-title">Happy Users</h2>
          <div className="ayur-testimonials-grid">
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">😊</div>
              <div className="ayur-testimonial-content">
                <p>"AyurSutra transformed our clinic operations. We've reduced no-shows by 40% and increased patient satisfaction significantly."</p>
                <div className="ayur-testimonial-author">
                  <h4>Dr. Priya Sharma</h4>
                  <p>Director, Aarogya Ayurvedic Center</p>
                </div>
              </div>
            </div>
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">😄</div>
              <div className="ayur-testimonial-content">
                <p>"The AI-powered assessment accurately identified my Prakriti, and the personalized treatment plan has been life-changing."</p>
                <div className="ayur-testimonial-author">
                  <h4>Rahul Mehta</h4>
                  <p>Patient for 6 months</p>
                </div>
              </div>
            </div>
            <div className="ayur-testimonial-card">
              <div className="ayur-happy-person">🥰</div>
              <div className="ayur-testimonial-content">
                <p>"Implementing AyurSutra has allowed us to scale our services while maintaining the personalized touch that Ayurveda requires."</p>
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
            <h2>Ready to Transform Your Ayurvedic Practice?</h2>
            <p>Join the revolution in Ayurvedic healthcare. Schedule a personalized demo to see how AyurSutra can elevate your clinic.</p>
            <form className="ayur-contact-form">
              <div className="ayur-form-row">
                <div className="ayur-form-group">
                  <input type="text" placeholder="Your Name" id="name" />
                </div>
                <div className="ayur-form-group">
                  <input type="email" placeholder="Email Address" id="email" />
                </div>
              </div>
              <div className="ayur-form-group ayur-full-width">
                <textarea placeholder="Tell us about your requirements" id="message" rows={4}></textarea>
              </div>
              <button type="submit" className="ayur-cta-button">Request a Demo</button>
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
              <p>Bridging Ancient Ayurvedic Wisdom with Modern Technology</p>
            </div>
            <div className="ayur-footer-section">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="#about">About Us</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
            <div className="ayur-footer-section">
              <h3>Contact Us</h3>
              <p>Email: info@ayursutra.com</p>
              <p>Phone: +91 98765 43210</p>
              <p>Address: Ayurveda Tech Park, Pune, Maharashtra</p>
            </div>
          </div>
          <div className="ayur-copyright">
            <p>&copy; 2023 AyurSutra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Truck, Stethoscope, FileText, HeartPulse, ArrowRight, ShoppingCart, Leaf } from 'lucide-react';

const EmartHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      icon: <Leaf className="w-8 h-8 text-ayur-green" />,
      title: "1000+ Ayurvedic Products",
      description: "Comprehensive range of classical and proprietary medicines"
    },
    {
      icon: <Shield className="w-8 h-8 text-ayur-gold" />,
      title: "100% Authentic",
      description: "Verified products from licensed pharmacies and brands"
    },
    {
      icon: <Truck className="w-8 h-8 text-green-600" />,
      title: "Fast Delivery",
      description: "Get your essentials delivered to your doorstep quickly"
    },
    {
      icon: <Stethoscope className="w-8 h-8 text-ayur-red" />,
      title: "Vaidya Consultations",
      description: "Connect with certified Ayurvedic practitioners instantly"
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-600" />,
      title: "Prescription Management",
      description: "Upload, store and refill prescriptions easily"
    },
    {
      icon: <HeartPulse className="w-8 h-8 text-pink-600" />,
      title: "Holistic Wellness",
      description: "Personalized health plans and dosha-based recommendations"
    }
  ];

  return (
    <AnimatePresence>
      {loading ? (
        <motion.div 
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 bg-gradient-to-br from-primary to-accent flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ 
              repeat: Infinity,
              repeatType: "reverse",
              duration: 0.8
            }}
          >
            <div className="flex items-center space-x-3">
              <Leaf className="w-16 h-16 text-white animate-pulse" />
              <h1 className="text-4xl font-playfair font-bold text-white">AyurVeda Mart</h1>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.main 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 overflow-hidden"
        >
          {/* Floating Particles */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: Math.random() * 100,
                  y: Math.random() * 100,
                  rotate: Math.random() * 360
                }}
                animate={{
                  x: [null, Math.random() * 100],
                  y: [null, Math.random() * 100],
                  rotate: [null, Math.random() * 360]
                }}
                transition={{
                  duration: 15 + Math.random() * 20,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "linear"
                }}
                className="absolute text-primary/20"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`
                }}
              >
                <Leaf className="w-8 h-8 opacity-50" />
              </motion.div>
            ))}
          </div>

          {/* Hero Section */}
          <section className="relative pt-32 pb-20 px-6 text-center">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="relative z-10"
            >
              <div className="flex justify-center mb-6">
                <div className="bg-gradient-to-r from-primary to-accent text-white p-4 rounded-full shadow-xl">
                  <Leaf className="w-10 h-10" />
                </div>
              </div>
              <h1 className="text-4xl sm:text-6xl font-playfair font-bold text-gray-900 mb-6 leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  AyurVeda
                </span> Mart
              </h1>
              <p className="text-xl sm:text-2xl max-w-3xl mx-auto text-gray-700 mb-10 font-inter">
                Your <span className="font-semibold text-primary">trusted</span> digital Ayurvedic marketplace for <span className="font-semibold text-accent">authentic</span> formulations and wellness products.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/emart/products')}
                  className="px-8 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Start Shopping</span>
                </motion.button>
              </div>
            </motion.div>
          </section>

          {/* Features */}
          <section className="relative py-20 px-6 bg-white/70 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto">
              <motion.h2 
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-5xl font-playfair font-bold text-center text-gray-900 mb-16"
              >
                Why <span className="text-primary">AyurVeda Mart</span>?
              </motion.h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="p-8 rounded-2xl bg-white border border-border shadow-sm hover:shadow-md transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center mb-4">
                      <div className="p-3 rounded-full bg-primary/10 mr-4">
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-bold font-playfair text-gray-900">{feature.title}</h3>
                    </div>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative py-20 px-6 bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <div className="max-w-4xl mx-auto text-center">
              <motion.h2 
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl font-playfair font-bold mb-6"
              >
                Ready to Restore Your Natural Balance?
              </motion.h2>
              <motion.p
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="text-xl mb-8 opacity-90"
              >
                Discover ancient wisdom through our curated collection of verified Ayurvedic remedies.
              </motion.p>
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <button
                  onClick={() => navigate('/emart/products')}
                  className="px-8 py-4 bg-white text-primary rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  Browse Catalog
                </button>
              </motion.div>
            </div>
          </section>
        </motion.main>
      )}
    </AnimatePresence>
  );
};

export default EmartHome;

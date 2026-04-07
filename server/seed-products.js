import admin from "firebase-admin";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

const dummyProducts = [
  // CLASSICAL MEDICINES
  {
    name: "Ashwagandha Extract 500mg", description: "Premium pure Ashwagandha root extract. Known for its stress-relieving properties and ability to improve energy levels. High potency formulation.", price: 450, stock: 120, imageUrl: "https://images.unsplash.com/photo-1611078516053-2ceaf8053a49?w=500&auto=format&fit=crop&q=60", category: "Classical Medicines", brand: "AyurVeda Naturals", prescription: false, rating: 4.8, discount: 10, expiry: "2026-12-31"
  },
  {
    name: "Triphala Churna", description: "A combination of three fruits: Amla, Haritaki, and Vibhitaki. Excellent for digestion, bowel movement, and detoxification.", price: 150, stock: 200, imageUrl: "https://images.unsplash.com/photo-1505576399279-b13ab8e6ebdb?w=500&auto=format&fit=crop&q=60", category: "Classical Medicines", brand: "AyurVeda Naturals", prescription: false, rating: 4.6, discount: 5, expiry: "2025-08-11"
  },
  {
    name: "Brahmi Vati", description: "Medicated Ayurvedic tablets for improving memory, concentration, and reducing mental stress. Must be taken under medical supervision.", price: 210, stock: 45, imageUrl: "https://images.unsplash.com/photo-1576092023537-885748a7bde2?w=500&auto=format&fit=crop&q=60", category: "Classical Medicines", brand: "Baidyanath", prescription: true, rating: 4.7, discount: 0, expiry: "2025-11-30"
  },
  {
    name: "Shilajit Gold Resin", description: "Pure Himalayan Shilajit resin. Enriched with Gold, naturally boosts stamina, vigor, and helps in muscle recovery post workouts.", price: 1299, stock: 65, imageUrl: "https://images.unsplash.com/photo-1620916297397-a4a5402a3c6c?w=500&auto=format&fit=crop&q=60", category: "Classical Medicines", brand: "Patanjali", prescription: false, rating: 4.9, discount: 15, expiry: "2027-02-15"
  },

  // IMMUNITY BOOSTERS
  {
    name: "Chyawanprash Special", description: "An ancient Ayurvedic formulation made with Amla and 40+ herbs. Boosts immunity, improves digestion, and provides energy for the whole day.", price: 320, stock: 50, imageUrl: "https://images.unsplash.com/photo-1599813358055-667954e3d735?w=500&auto=format&fit=crop&q=60", category: "Immunity Boosters", brand: "Dabur", prescription: false, rating: 4.5, discount: 0, expiry: "2025-10-15"
  },
  {
    name: "Giloy Ghanvati", description: "Potent immunity booster extract derived from Giloy (Tinospora Cordifolia) stems. Deeply purifies blood and fights recurring infections.", price: 180, stock: 350, imageUrl: "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=500&auto=format&fit=crop&q=60", category: "Immunity Boosters", brand: "Zandu", prescription: false, rating: 4.6, discount: 5, expiry: "2026-06-12"
  },
  {
    name: "Pure Amla Juice", description: "Cold-pressed juice from wild Indian gooseberries. Extremely high Vitamin C content bridging immunity gaps seamlessly.", price: 240, stock: 110, imageUrl: "https://images.unsplash.com/photo-1599813358055-667954e3d735?w=500&auto=format&fit=crop&q=60", category: "Immunity Boosters", brand: "Kapiva", prescription: false, rating: 4.7, discount: 12, expiry: "2024-12-01"
  },
  {
    name: "Panch Tulsi Drops", description: "Liquid extract from 5 rare variants of Tulsi. Instantly supports respiratory wellness and throat soothing.", price: 195, stock: 500, imageUrl: "https://images.unsplash.com/photo-1582582494541-d64fcff1df14?w=500&auto=format&fit=crop&q=60", category: "Immunity Boosters", brand: "Dabur", prescription: false, rating: 4.8, discount: 0, expiry: "2027-01-01"
  },

  // PERSONAL CARE
  {
    name: "Kumkumadi Tailam", description: "Authentic Ayurvedic facial oil formulated with pure saffron. Helps in reducing blemishes, dark circles, and improves skin complexion.", price: 899, stock: 30, imageUrl: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500&auto=format&fit=crop&q=60", category: "Personal Care", brand: "Kama Ayurveda", prescription: false, rating: 4.9, discount: 15, expiry: "2026-05-20"
  },
  {
    name: "Bhringraj Hair Oil", description: "Intensive hair care oil that prevents hair fall, dandruff, and premature graying. Made with pure herbs following traditional Taila Paka Vidhi.", price: 350, stock: 85, imageUrl: "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60", category: "Personal Care", brand: "Himalaya", prescription: false, rating: 4.3, discount: 0, expiry: "2026-01-10"
  },
  {
    name: "Neem Purifying Face Wash", description: "Anti-bacterial herbal wash for acne-prone skin. Infused with Turmeric and Neem to provide naturally radiant skin.", price: 140, stock: 300, imageUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500&auto=format&fit=crop&q=60", category: "Personal Care", brand: "Himalaya", prescription: false, rating: 4.5, discount: 5, expiry: "2025-09-02"
  },
  {
    name: "Mysore Sandalwood Soap", description: "Classic cold-pressed soap utilizing pure sandalwood oil. Cooling properties perfectly balancing Pitta dosha.", price: 90, stock: 650, imageUrl: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&auto=format&fit=crop&q=60", category: "Personal Care", brand: "Mysore Sandal", prescription: false, rating: 4.8, discount: 0, expiry: "2030-01-01"
  },

  // HERBAL TEAS
  {
    name: "Dashmool Kwath Tea", description: "A therapeutic blend of 10 healing roots. Ideal for Vata pacification, nerve soothing, and postnatal recovery.", price: 290, stock: 75, imageUrl: "https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=500&auto=format&fit=crop&q=60", category: "Herbal Teas", brand: "Patanjali", prescription: false, rating: 4.4, discount: 0, expiry: "2026-03-12"
  },
  {
    name: "Tulsi Green Tea Ashwagandha", description: "Refreshing holistic beverage blending antioxidants with stamina building adaptogens. Calms mind perfectly.", price: 210, stock: 154, imageUrl: "https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?w=500&auto=format&fit=crop&q=60", category: "Herbal Teas", brand: "Organic India", prescription: false, rating: 4.7, discount: 5, expiry: "2025-11-22"
  }
];

async function seedProducts() {
  console.log("Starting to seed products...");
  const batch = db.batch();
  
  dummyProducts.forEach(product => {
    const docRef = db.collection("products").doc();
    batch.set(docRef, product);
  });

  try {
    await batch.commit();
    console.log(`Successfully seeded ${dummyProducts.length} products to Firestore.`);
  } catch (error) {
    console.error("Error seeding products:", error);
  } finally {
    process.exit(0);
  }
}

seedProducts();

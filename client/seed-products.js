import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, writeBatch } from "firebase/firestore";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, ".env") });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dummyProducts = [
  {
    name: "Ashwagandha Extract 500mg",
    description: "Premium pure Ashwagandha root extract. Known for its stress-relieving properties and ability to improve energy levels. High potency formulation.",
    price: 450,
    stock: 120,
    imageUrl: "https://images.unsplash.com/photo-1611078516053-2ceaf8053a49?w=500&auto=format&fit=crop&q=60",
    category: "Classical Medicines",
    brand: "AyurVeda Naturals",
    prescription: false,
    rating: 4.8,
    discount: 10,
    expiry: "2026-12-31"
  },
  {
    name: "Chyawanprash Special",
    description: "An ancient Ayurvedic formulation made with Amla and 40+ herbs. Boosts immunity, improves digestion, and provides energy for the whole day.",
    price: 320,
    stock: 50,
    imageUrl: "https://images.unsplash.com/photo-1599813358055-667954e3d735?w=500&auto=format&fit=crop&q=60",
    category: "Immunity Boosters",
    brand: "Dabur",
    prescription: false,
    rating: 4.5,
    discount: 0,
    expiry: "2025-10-15"
  },
  {
    name: "Kumkumadi Tailam",
    description: "Authentic Ayurvedic facial oil formulated with pure saffron. Helps in reducing blemishes, dark circles, and improves skin complexion.",
    price: 899,
    stock: 30,
    imageUrl: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500&auto=format&fit=crop&q=60",
    category: "Personal Care",
    brand: "Kama Ayurveda",
    prescription: false,
    rating: 4.9,
    discount: 15,
    expiry: "2026-05-20"
  },
  {
    name: "Triphala Churna",
    description: "A combination of three fruits: Amla, Haritaki, and Vibhitaki. Excellent for digestion, bowel movement, and detoxification.",
    price: 150,
    stock: 200,
    imageUrl: "https://images.unsplash.com/photo-1505576399279-b13ab8e6ebdb?w=500&auto=format&fit=crop&q=60",
    category: "Classical Medicines",
    brand: "AyurVeda Naturals",
    prescription: false,
    rating: 4.6,
    discount: 5,
    expiry: "2025-08-11"
  },
  {
    name: "Bhringraj Hair Oil",
    description: "Intensive hair care oil that prevents hair fall, dandruff, and premature graying. Made with pure herbs following traditional Taila Paka Vidhi.",
    price: 350,
    stock: 85,
    imageUrl: "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60",
    category: "Personal Care",
    brand: "Himalaya",
    prescription: false,
    rating: 4.3,
    discount: 0,
    expiry: "2026-01-10"
  },
  {
    name: "Brahmi Vati",
    description: "Medicated Ayurvedic tablets for improving memory, concentration, and reducing mental stress. Must be taken under medical supervision.",
    price: 210,
    stock: 45,
    imageUrl: "https://images.unsplash.com/photo-1576092023537-885748a7bde2?w=500&auto=format&fit=crop&q=60",
    category: "Classical Medicines",
    brand: "Baidyanath",
    prescription: true,
    rating: 4.7,
    discount: 0,
    expiry: "2025-11-30"
  }
];

async function seedProducts() {
  console.log("Starting to seed products...");
  const batch = writeBatch(db);
  
  dummyProducts.forEach(product => {
    const docRef = doc(collection(db, "products"));
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

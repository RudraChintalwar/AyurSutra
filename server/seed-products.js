const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Use existing service account credentials from env or JSON file if needed.
// This assumes server/src/config/firebaseHelper.js or similar initializes app.
// Since we don't have a direct service account json in repo, let's just initialize using application default or env.
// Alternatively, since we are running locally, I can just use a generic config. But wait, server has firebase-admin.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
  : require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

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

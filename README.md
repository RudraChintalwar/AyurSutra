<div align="center">
  <img src="client/public/favicon.ico" alt="AyurSutra Logo" width="100" />
  <h1>AyurSutra — Unified Ayurvedic Healthcare Platform</h1>
  <p>An intelligent, ML-powered platform connecting ancient Ayurvedic wisdom with modern healthcare technology.</p>

  [![React](https://img.shields.io/badge/React-18.2-blue.svg?style=flat-square&logo=react)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
  [![Node.js](https://img.shields.io/badge/Node.js-Express-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-ML_Service-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28.svg?style=flat-square&logo=firebase)](https://firebase.google.com/)
</div>

---

## 📖 About The Project

**AyurSutra** is a comprehensive, full-stack healthcare platform that bridges the gap between traditional Ayurvedic medicine and modern clinical workflows. In the traditional setting, diagnosing doshas and tracking holistic recovery is a fragmented, heavily manual process. AyurSutra solves this by offering interconnected portals for **Patients** and **Ayurvedic Practitioners (Vaidyas)**, integrated with an AI-powered diagnostic engine, machine-learning-backed Panchakarma scheduling, and an E-Commerce pharmacy.

---

## 🌟 Core Application Features

The project is packed with advanced healthcare subsystems:

### 🧘 Patient Portal & Intelligences
- **Dynamic Dosha Analysis:** An interactive diagnostic quiz that determines a patient's core biological constitution (Vata, Pitta, Kapha) and adjusts the dashboard's holistic recommendations accordingly.
- **AI-Powered Report Analyzer:** Securely upload standard medical reports. A specialized NLP engine parses the blood/health metrics, highlighting anomalies and translating them into Ayurvedic diagnostic implications (e.g., identifying aggravated Pitta).
- **Personalized Diet Planner:** Recommends highly personalized nutritional frameworks (*Ahara*) and restriction regimens based on the user's Dosha status and current symptom severity.
- **Digital Pulse Monitor:** An innovative concept module estimating conventional *Nadi Pariksha* (Pulse assessment). It logs specific physiological variations to visualize changes in baseline cardiovascular health.
- **Authentic Medicine Verifier:** Allows patients to authenticate Ayurvedic products by cross-referencing batch numbers to ensure medicinal safety and formula integrity.

### 📅 Smart Panchakarma Scheduling (ML)
- **Neural Network Triage:** A Machine-Learning backed system built on **2,00,000 (2 Lakh) rows** of historical Ayurvedic interventions. When patients input symptoms asynchronously, the system accurately predicts the most optimal Panchakarma therapy (e.g., *Basti, Vamana, Virechana*).

### 🩺 Practitioner (Doctor) Portal
- **Priority Access Queue:** Replaces traditional chronological wait-lists. Doctors evaluate a dynamic queue automatically sorted by an LLM-computed severity triage score, focusing on high-risk patients instantly.
- **Intervention Management:** Centralized dashboard for doctors to review ML predictions, update therapy schedules, and provide continuous feedback on patient physical progress.

### 🛒 AyurVeda E-Mart
- **E-Commerce Module:** A dedicated, fully functional digital pharmacy for users to safely purchase prescribed, authentic Ayurvedic remedies. Complete with categorized browsing, shopping cart logic, and transparent checkout protocols.

---

## 🏗️ System Architecture

AyurSutra relies on a Microservices-inspired operational structure dividing computational burdens efficiently:

1. **Frontend Presentation (React/Vite & Tailwind):** Highly responsive UI that captures patient interaction. Connects strictly through secure JSON Web Tokens to backend components.
2. **Business Logic API (Node.js/Express):** Manages essential routing, Groq LLM API integrations (for real-time triage scoring), and direct NoSQL database queries.
3. **ML Computational Service (FastAPI):** A devoted Python instance separated from standard APIs to host the heavy Artificial Neural Network capable of fast classification predictions on enormous symptom matrices.
4. **Data Persistence Context (Firebase):** Google Firebase manages both robust User Authentication and real-time Firestore database synchronization linking the Patient and Doctor dashboards concurrently.

```text
AyurSutra/
├── client/                     # React (Vite) + TypeScript Frontend
│   ├── src/components/         # Reusable UI components (shadcn/ui + Tailwind)
│   ├── src/pages/              # Route-level pages (Dashboards, E-Mart, Auth)
│   └── src/lib/firebase.ts     # Firebase connection & services
│
├── server/                     # Node.js + Express Backend
│   ├── src/routes/             # API routes (Chatbot, Notifications, Auth)
│   └── src/services/           # Nodemailer, Groq LLM logic, Server configuration
│
└── ml-service/                 # Python + FastAPI ML Microservice
    ├── models/                 # Pre-trained NN models (.keras) & encoders
    └── main.py                 # FastAPI prediction endpoints for Panchakarma
```

---

## 🚀 Getting Started

Follow these steps to set up the environment and run the platform locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Python](https://www.python.org/) (3.9+ for the ML Service)
- [Git](https://git-scm.com/)

### 1. Clone & Setup
Clone the repository and install the dependencies for all three interconnected services.

**Client (Frontend)**
```bash
cd client
npm install
```

**Server (Backend)**
```bash
cd server
npm install
```

**ML Service (Predictive Engine)**
```bash
cd ml-service
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Environment Variables
You must set up environment variables for the application to interface cleanly with Firebase and the Groq LLM.

**`client/.env`**
```env
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=ayursutra-3311d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ayursutra-3311d
VITE_FIREBASE_STORAGE_BUCKET=ayursutra-3311d.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=http://localhost:3001
VITE_ML_API_URL=http://localhost:8000
```

**`server/.env`**
```env
PORT=3001
GROQ_API_KEY=your_groq_api_key
```

### 3. Running the Platform
You will need three terminal windows to run the entire stack concurrently during development.

**Terminal 1: Start the Backend Server**
```bash
cd server
npm run dev
```

**Terminal 2: Start the ML Service**
```bash
cd ml-service
# Ensure virtual environment is activated
uvicorn main:app --reload --port 8000
```

**Terminal 3: Start the Frontend Client**
```bash
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser to explore the platform.

---

## 🧪 Testing the Workflow

To experience the full capability of the system, try the following end-to-end flow:

1. **Patient Registration:** Navigate to the auth page and register a new patient account to initialize your profile (or use the *Test Patient* fast bypass button natively built into login).
2. **Diagnostic Features:** Try uploading a mock blood report in the **Report Analyzer**, run the **Pulse Monitor** logic, and view the personalized **Diet Plan** generated based on Dosha parameters.
3. **E-Mart Checkout:** Open the AyurVeda Mart, add a remedy (e.g., Brahmi Vati) to the cart, check authenticity via **Medicine Verifier**, and interact with the checkout flow.
4. **Therapy Scheduling:** Click 'Book New Session'. Fill in symptoms (e.g., "Severe joints pain"). The frontend will pass this to the **ML-Service**, dynamically predicting an Ayurvedic therapy (e.g., *Basti* or *Vamana*).
5. **Doctor Review:** Sign out, and register/login as a Practitioner (or use the *Test Doctor* fast bypass). View your priority queue to see the patient you just booked, systematically sorted by the AI severity score!

---

*Built with ❤️ bridging traditional medicine with futuristic computation.*
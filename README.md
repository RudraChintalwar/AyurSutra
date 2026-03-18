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

**AyurSutra** is a comprehensive, full-stack healthcare platform that bridges the gap between traditional Ayurvedic medicine and modern clinical workflows. It offers parallel portals for both **Patients** and **Ayurvedic Practitioners (Doctors)**, integrated with an E-Commerce store and an AI-powered diagnostic and scheduling engine.

### Key Features
- 🧘 **Dosha Analysis**: Interactive 12-question quiz determining a patient's primary constitution (Vata, Pitta, Kapha) and offering targeted lifestyle advice.
- 📅 **Smart Panchakarma Scheduling**: Machine-learning backed system to predict needed therapies, prioritize severe cases dynamically queueing them for practitioners.
- 🛒 **AyurVeda Mart**: Integrated E-Commerce shop to safely purchase authentic Ayurvedic remedies, complete with cart and checkout.
- 🤖 **Digital Vaidya (AI Chatbot)**: 24/7 Groq-powered conversational agent tuned to provide classical Ayurvedic text-based triage and support.
- 📊 **Practitioner Portal**: Centralized dashboard for doctors to manage appointments, review patient records, analyze health metrics, and approve treatment plans.

---

## 🏗️ Architecture

The project is structured as a robust monorepo to ensure seamless collaboration between the frontend UI, backend business logic, and the machine learning model.

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

1. **Patient Registration:** Navigate to the auth page and register a new patient account to initialize your profile in Firestore.
2. **Dosha Quiz:** Complete the lifestyle questionnaire on your dashboard. Evaluate the personalized Diet Plan and Herbal Remedies rendered based on your score.
3. **E-Mart Checkout:** Open the AyurVeda Mart, add a remedy (e.g., Brahmi Vati) to the cart, and proceed through the checkout flow.
4. **Therapy Scheduling:** Under 'Sessions', click 'Book New Session'. Fill in symptoms (e.g., "Severe joints pain"). The frontend will pass this to the **ML-Service**, which will dynamically suggest an Ayurvedic therapy (e.g., *Basti* or *Vamana*).
5. **Doctor Review:** Sign out, and register as a Practitioner (use the verification code `AyurSutraDoc7898`). View your priority queue to see the patient you just booked, sorted by the Groq LLM severity score.

---

## 🤝 Contributing

We welcome community contributions. To contribute:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

*Built with ❤️ for SIH*
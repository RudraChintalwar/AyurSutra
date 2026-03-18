"""
AyurSutra ML Service — Panchakarma Therapy Prediction
FastAPI server that serves a trained Neural Network model
for predicting appropriate Panchakarma therapies.
"""
import os
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="AyurSutra ML Service",
    description="Panchakarma therapy prediction using Neural Network + SentenceTransformer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global model variables ──────────────────────────────
model = None
embedder = None
mlb = None
threshold = 0.5
severity_clf = None
session_reg = None
duration_reg = None


def load_models():
    """Load ML models on startup."""
    global model, embedder, mlb, threshold, severity_clf, session_reg, duration_reg, cnn_auth_model, cnn_tokenizer

    models_dir = os.path.join(os.path.dirname(__file__), "models")
    data_dir = os.path.join(os.path.dirname(__file__), "data")

    try:
        import tensorflow as tf
        from sentence_transformers import SentenceTransformer
        import joblib

        model_path = os.path.join(models_dir, "panchakarma_nn.keras")
        mlb_path = os.path.join(data_dir, "mlb.joblib")
        threshold_path = os.path.join(models_dir, "optimal_threshold.joblib")

        if os.path.exists(model_path):
            model = tf.keras.models.load_model(model_path)
            print(f"✅ Loaded neural network model from {model_path}")
        else:
            print(f"⚠️  Model file not found at {model_path}")

        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        print("✅ Loaded SentenceTransformer embedder")

        if os.path.exists(mlb_path):
            mlb = joblib.load(mlb_path)
            print(f"✅ Loaded label binarizer from {mlb_path}")
        else:
            print(f"⚠️  Label binarizer not found at {mlb_path}")

        if os.path.exists(threshold_path):
            threshold = joblib.load(threshold_path)
            print(f"✅ Loaded optimal threshold: {threshold}")
        else:
            print("ℹ️  Using default threshold: 0.5")

    except ImportError as e:
        print(f"⚠️  ML dependencies not installed: {e}")
        print("   The service will run in fallback mode.")
    except Exception as e:
        print(f"⚠️  Error loading models: {e}")

    # Load RF models
    try:
        sev_path = os.path.join(models_dir, "severity_clf.joblib")
        sess_path = os.path.join(models_dir, "session_regressor.joblib")
        dur_path = os.path.join(models_dir, "duration_regressor.joblib")

        if os.path.exists(sev_path):
            severity_clf = joblib.load(sev_path)
            print(f"✅ Loaded RF Severity Classifier")
        else:
            print(f"⚠️  RF Severity Classifier not found (run train_models.py first)")

        if os.path.exists(sess_path):
            session_reg = joblib.load(sess_path)
            print(f"✅ Loaded RF Session Regressor")

        if os.path.exists(dur_path):
            duration_reg = joblib.load(dur_path)
            print(f"✅ Loaded RF Duration Regressor")
    except Exception as e:
        print(f"⚠️  Error loading RF models: {e}")

    # Load CNN Auth model
    try:
        import tensorflow as tf
        import joblib
        cnn_path = os.path.join(models_dir, "cnn_auth.keras")
        tok_path = os.path.join(models_dir, "cnn_tokenizer.joblib")
        if os.path.exists(cnn_path) and os.path.exists(tok_path):
            cnn_auth_model = tf.keras.models.load_model(cnn_path)
            cnn_tokenizer = joblib.load(tok_path)
            print("✅ Loaded CNN Authentication Model")
        else:
            cnn_auth_model, cnn_tokenizer = None, None
            print("⚠️  CNN Auth Model not found")
    except Exception as e:
        print(f"⚠️  Error loading CNN Auth Model: {e}")


# ─── Request/Response models ─────────────────────────────
class PredictionRequest(BaseModel):
    symptoms: str
    dosha: str = "Unknown"
    age: int = 35
    gender: str = "Unknown"


class SeverityRequest(BaseModel):
    symptoms: str  # comma-separated or descriptive
    dosha: str = "Unknown"
    pain: int = 5
    inflammation: int = 5
    fatigue: int = 5
    digestive: int = 5
    stress: int = 5


class SessionPredRequest(BaseModel):
    severity: int = 5
    dosha: str = "Unknown"
    age: int = 35
    gender: str = "Unknown"

class AuthRequest(BaseModel):
    text: str = ""
    image_base64: str = ""


class PredictionResponse(BaseModel):
    predictions: list
    confidence: list
    model_loaded: bool


# ─── Routes ──────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    load_models()


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "AyurSutra ML Service",
        "model_loaded": model is not None,
        "embedder_loaded": embedder is not None,
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if model is None or embedder is None or mlb is None:
        # Fallback: return common therapies
        return PredictionResponse(
            predictions=["Abhyanga (oil massage)", "Shirodhara (oil pouring)"],
            confidence=[0.6, 0.5],
            model_loaded=False,
        )

    try:
        # Construct input text (same format as training data)
        input_text = f"Symptoms: {request.symptoms}. "
        input_text += f"Dosha: {request.dosha}. "
        input_text += f"Age: {request.age}. Gender: {request.gender}."

        # Generate embedding
        embedding = embedder.encode([input_text])

        # Predict
        raw_pred = model.predict(embedding, verbose=0)
        pred_binary = (raw_pred >= threshold).astype(int)

        # Decode labels
        predicted_labels = mlb.inverse_transform(pred_binary)
        predictions = list(predicted_labels[0]) if predicted_labels[0] else [
            "Abhyanga (oil massage)"
        ]

        # Get confidence scores for predicted therapies
        confidence_scores = []
        for label in predictions:
            idx = list(mlb.classes_).index(label) if label in mlb.classes_ else 0
            confidence_scores.append(float(raw_pred[0][idx]))

        return PredictionResponse(
            predictions=predictions,
            confidence=confidence_scores,
            model_loaded=True,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ─── Report Analysis (replaces reportanalyser.py) ────────
class ReportRequest(BaseModel):
    text: str


AYURVEDIC_KNOWLEDGE = {
    "vata": {
        "imbalance": "Vata Dosha imbalance",
        "recommendations": "Warm, moist, grounding foods; regular routine; gentle exercise; oil massage",
        "herbs": ["Ashwagandha", "Bala", "Shatavari", "Ginger", "Cinnamon"],
    },
    "pitta": {
        "imbalance": "Pitta Dosha imbalance",
        "recommendations": "Cool, refreshing foods; avoid spicy foods; moderate exercise; cooling pranayama",
        "herbs": ["Shatavari", "Amla", "Brahmi", "Coriander", "Fennel"],
    },
    "kapha": {
        "imbalance": "Kapha Dosha imbalance",
        "recommendations": "Light, warm, dry foods; vigorous exercise; stimulating herbs",
        "herbs": ["Turmeric", "Ginger", "Black Pepper", "Trikatu", "Pippali"],
    },
}


def detect_dosha_from_text(text: str) -> str:
    text_lower = text.lower()
    vata_kw = ["vata", "dry", "cold", "light", "anxiety", "constipation", "insomnia"]
    pitta_kw = ["pitta", "hot", "sharp", "inflammatory", "acidic", "anger", "irritation"]
    kapha_kw = ["kapha", "heavy", "slow", "oily", "congestion", "lethargy"]

    scores = {
        "vata": sum(1 for w in vata_kw if w in text_lower),
        "pitta": sum(1 for w in pitta_kw if w in text_lower),
        "kapha": sum(1 for w in kapha_kw if w in text_lower),
    }

    return max(scores, key=scores.get) if max(scores.values()) > 0 else "vata"


@app.post("/analyze-report")
async def analyze_report(request: ReportRequest):
    dosha = detect_dosha_from_text(request.text)
    info = AYURVEDIC_KNOWLEDGE[dosha]

    return {
        "dosha_imbalance": info["imbalance"],
        "recommendations": info["recommendations"],
        "herbal_remedies": info["herbs"],
        "detected_dosha": dosha,
    }


# ─── RF Classifier: Severity Scoring ─────────────────────
@app.post("/classify-severity")
async def classify_severity(request: SeverityRequest):
    dosha_map = {"vata": 0, "pitta": 1, "kapha": 2}
    dosha_val = 0
    for key, val in dosha_map.items():
        if key in request.dosha.lower():
            dosha_val = val
            break

    features = [[request.pain, request.inflammation, request.fatigue,
                 request.digestive, request.stress, dosha_val]]

    if severity_clf is not None:
        import numpy as np
        prediction = severity_clf.predict(features)
        probabilities = severity_clf.predict_proba(features)
        severity_score = int(prediction[0])
        confidence = float(np.max(probabilities[0]))
        return {
            "severity_score": severity_score,
            "confidence": round(confidence, 3),
            "classification": "Acute" if severity_score >= 7 else ("Moderate" if severity_score >= 4 else "Mild"),
            "model_loaded": True
        }
    else:
        # Fallback: calculate from inputs
        avg = (request.pain + request.inflammation + request.fatigue +
               request.digestive + request.stress) / 5
        return {
            "severity_score": int(round(avg)),
            "confidence": 0.6,
            "classification": "Acute" if avg >= 7 else ("Moderate" if avg >= 4 else "Mild"),
            "model_loaded": False
        }


# ─── RF Regressor: Session & Duration Prediction ─────────
@app.post("/predict-sessions")
async def predict_sessions(request: SessionPredRequest):
    dosha_map = {"vata": 0, "pitta": 1, "kapha": 2}
    dosha_val = 0
    for key, val in dosha_map.items():
        if key in request.dosha.lower():
            dosha_val = val
            break

    gender_val = 1 if request.gender.lower() in ["male", "m"] else 0
    features = [[request.severity, dosha_val, request.age, gender_val]]

    sessions_needed = 3
    duration_minutes = 60

    if session_reg is not None:
        sessions_needed = int(round(session_reg.predict(features)[0]))
        sessions_needed = max(2, min(sessions_needed, 7))

    if duration_reg is not None:
        duration_minutes = int(round(duration_reg.predict(features)[0]))
        duration_minutes = max(30, min(duration_minutes, 120))

    return {
        "sessions_needed": sessions_needed,
        "duration_minutes": duration_minutes,
        "spacing_days": 3 if request.severity <= 4 else (5 if request.severity <= 7 else 7),
        "model_loaded": session_reg is not None
    }


# ─── OCR + CNN Pharmaceutical Authentication ─────────────
@app.post("/authenticate-medicine")
async def authenticate_medicine(request: AuthRequest):
    """
    Authenticate Ayurvedic medicine labels.
    Accepts either extracted text or base64 image.
    Uses keyword matching + confidence scoring (CNN placeholder).
    """
    analysis_text = request.text.lower() if request.text else ""

    # OCR simulation: if base64 image provided, extract text (placeholder)
    if request.image_base64 and not request.text:
        # In production, use Tesseract OCR here
        analysis_text = "unable to process image - provide extracted text"

    if not analysis_text:
        return {"authenticated": False, "confidence": 0, "reason": "No text provided"}

    # ─── CNN Model Prediction ─────────────────────────────────
    if 'cnn_auth_model' in globals() and cnn_auth_model is not None and cnn_tokenizer is not None:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
            seq = cnn_tokenizer.texts_to_sequences([analysis_text])
            padded = pad_sequences(seq, maxlen=20, padding='post')
            pred = cnn_auth_model.predict(padded, verbose=0)[0][0]
            
            is_authentic = bool(pred > 0.5)
            confidence = float(pred if is_authentic else 1.0 - pred)
            
            return {
                "authenticated": is_authentic,
                "confidence": round(confidence, 3),
                "classification": "Authentic" if is_authentic else "Suspicious/Counterfeit",
                "formulation": analysis_text[:50].title(),
                "ingredient_matches": 0,
                "manufacturer_verified": is_authentic,
                "model_used": "CNN Text Classifier"
            }
        except Exception as e:
            print(f"CNN prediction error: {e}")

    # ─── Fallback string matching if CNN fails ────────────────
    # Known authentic Ayurvedic formulations database
    AUTHENTIC_FORMULATIONS = {
        "triphala": {"ingredients": ["amalaki", "bibhitaki", "haritaki"], "manufacturer": ["dabur", "patanjali", "himalaya", "baidyanath"]},
        "chyawanprash": {"ingredients": ["amla", "honey", "ghee", "sesame oil"], "manufacturer": ["dabur", "patanjali", "zandu"]},
        "ashwagandha": {"ingredients": ["withania somnifera", "ashwagandha"], "manufacturer": ["himalaya", "organic india", "patanjali"]},
        "brahmi": {"ingredients": ["bacopa monnieri", "brahmi"], "manufacturer": ["himalaya", "organic india"]},
        "trikatu": {"ingredients": ["black pepper", "long pepper", "ginger"], "manufacturer": ["dabur", "baidyanath"]},
        "guggulu": {"ingredients": ["commiphora wightii", "guggul"], "manufacturer": ["dabur", "baidyanath", "patanjali"]},
    }

        analysis_text = "unable to process image - provide extracted text"

    if not analysis_text:
        return {"authenticated": False, "confidence": 0, "reason": "No text provided"}

    # Check against known formulations
    matched_formulation = None
    ingredient_matches = 0
    manufacturer_match = False

    for name, info in AUTHENTIC_FORMULATIONS.items():
        if name in analysis_text:
            matched_formulation = name
            for ing in info["ingredients"]:
                if ing in analysis_text:
                    ingredient_matches += 1
            for mfg in info["manufacturer"]:
                if mfg in analysis_text:
                    manufacturer_match = True
            break

    if matched_formulation:
        total_ingredients = len(AUTHENTIC_FORMULATIONS[matched_formulation]["ingredients"])
        ingredient_score = ingredient_matches / total_ingredients if total_ingredients > 0 else 0
        confidence = 0.4 + (ingredient_score * 0.35) + (0.25 if manufacturer_match else 0)

        return {
            "authenticated": confidence >= 0.6,
            "confidence": round(confidence, 3),
            "formulation": matched_formulation,
            "ingredient_matches": ingredient_matches,
            "manufacturer_verified": manufacturer_match,
            "classification": "Authentic" if confidence >= 0.6 else "Suspicious",
        }
    else:
        return {
            "authenticated": False,
            "confidence": 0.2,
            "formulation": None,
            "reason": "Formulation not found in database",
            "classification": "Unknown",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

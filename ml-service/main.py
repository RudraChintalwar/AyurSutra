"""
AyurSutra ML Service — Panchakarma Therapy Prediction
FastAPI server that serves a trained Neural Network model
for predicting appropriate Panchakarma therapies.
"""
import os
import io
import base64
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
            print(f"[OK] Loaded neural network model from {model_path}")
        else:
            print(f"[WARN] Model file not found at {model_path}")

        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        print("[OK] Loaded SentenceTransformer embedder")

        if os.path.exists(mlb_path):
            mlb = joblib.load(mlb_path)
            print(f"[OK] Loaded label binarizer from {mlb_path}")
        else:
            print(f"[WARN] Label binarizer not found at {mlb_path}")

        if os.path.exists(threshold_path):
            threshold = joblib.load(threshold_path)
            print(f"[OK] Loaded optimal threshold: {threshold}")
        else:
            print("[INFO] Using default threshold: 0.5")

    except ImportError as e:
        print(f"[WARN] ML dependencies not installed: {e}")
        print("   The service will run in fallback mode.")
    except Exception as e:
        print(f"[WARN] Error loading models: {e}")

    # Load RF models
    try:
        sev_path = os.path.join(models_dir, "severity_clf.joblib")
        sess_path = os.path.join(models_dir, "session_regressor.joblib")
        dur_path = os.path.join(models_dir, "duration_regressor.joblib")

        if os.path.exists(sev_path):
            severity_clf = joblib.load(sev_path)
            print(f"[OK] Loaded RF Severity Classifier")
        else:
            print(f"[WARN] RF Severity Classifier not found (run train_models.py first)")

        if os.path.exists(sess_path):
            session_reg = joblib.load(sess_path)
            print(f"[OK] Loaded RF Session Regressor")

        if os.path.exists(dur_path):
            duration_reg = joblib.load(dur_path)
            print(f"[OK] Loaded RF Duration Regressor")
    except Exception as e:
        print(f"[WARN] Error loading RF models: {e}")

    # Load CNN Auth model
    try:
        import tensorflow as tf
        import joblib
        cnn_path = os.path.join(models_dir, "cnn_auth.keras")
        tok_path = os.path.join(models_dir, "cnn_tokenizer.joblib")
        if os.path.exists(cnn_path) and os.path.exists(tok_path):
            cnn_auth_model = tf.keras.models.load_model(cnn_path)
            cnn_tokenizer = joblib.load(tok_path)
            print("[OK] Loaded CNN Authentication Model")
        else:
            cnn_auth_model, cnn_tokenizer = None, None
            print("[WARN] CNN Auth Model not found")
    except Exception as e:
        print(f"[WARN] Error loading CNN Auth Model: {e}")


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
def run_ocr(image_base64: str) -> str:
    """
    Extract text from a base64-encoded image using Tesseract OCR.
    Returns the extracted text string, or empty string on failure.
    """
    try:
        from PIL import Image
        import pytesseract

        # Set Tesseract path explicitly for Windows
        import platform
        if platform.system() == "Windows":
            tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path

        # Strip optional data-URI prefix (e.g. "data:image/png;base64,")
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))

        # Pre-process for better OCR accuracy
        image = image.convert("RGB")

        # Run Tesseract OCR
        extracted = pytesseract.image_to_string(image, lang="eng")
        print(f"[OK] OCR extracted {len(extracted)} characters")
        return extracted.strip()
    except ImportError:
        print("[WARN] pytesseract or Pillow not installed -- OCR unavailable")
        return ""
    except Exception as e:
        print(f"[WARN] OCR failed: {e}")
        return ""


@app.post("/authenticate-medicine")
async def authenticate_medicine(request: AuthRequest):
    """
    Authenticate Ayurvedic medicine labels.
    Accepts either extracted text or base64 image.
    When an image is provided, OCR is used to extract label text first.
    Then the CNN model (or keyword fallback) authenticates the formulation.
    """
    ocr_text = ""
    analysis_text = request.text.lower() if request.text else ""

    # ─── OCR: extract text from image ─────────────────────────
    if request.image_base64:
        ocr_text = run_ocr(request.image_base64)
        if ocr_text:
            # If user also typed text, combine; otherwise use OCR output
            if analysis_text:
                analysis_text = f"{analysis_text} {ocr_text.lower()}"
            else:
                analysis_text = ocr_text.lower()
        elif not analysis_text:
            return {
                "authenticated": False,
                "confidence": 0,
                "reason": "OCR could not extract text from the image. Please try a clearer photo or type the label text manually.",
                "ocr_text": ""
            }

    if not analysis_text:
        return {"authenticated": False, "confidence": 0, "reason": "No text provided", "ocr_text": ""}

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
                "model_used": "CNN Text Classifier",
                "ocr_text": ocr_text if ocr_text else None
            }
        except Exception as e:
            print(f"CNN prediction error: {e}")

    # ─── Fallback string matching if CNN fails ────────────────
    # Known authentic Ayurvedic formulations database
    # Each entry has: ingredients (with alternate OCR-friendly spellings), manufacturers, and aliases
    AUTHENTIC_FORMULATIONS = {
        "triphala": {
            "aliases": ["triphala", "trifala", "triphla", "tri phala", "triphala churna"],
            "ingredients": ["amalaki", "bibhitaki", "haritaki", "emblica", "terminalia chebula", "terminalia belerica", "terminalia bellirica", "embilica", "officinalis"],
            "manufacturer": ["dabur", "patanjali", "himalaya", "baidyanath", "zandu", "sharangdhar", "dhootapapeshwar"]
        },
        "chyawanprash": {
            "aliases": ["chyawanprash", "chyavanprash", "chywanprash", "chyavanprasha"],
            "ingredients": ["amla", "honey", "ghee", "sesame oil", "ashwagandha", "pippali", "emblica"],
            "manufacturer": ["dabur", "patanjali", "zandu", "baidyanath"]
        },
        "ashwagandha": {
            "aliases": ["ashwagandha", "ashvagandha", "ashwgandha", "withania"],
            "ingredients": ["withania somnifera", "ashwagandha", "withania"],
            "manufacturer": ["himalaya", "organic india", "patanjali", "dabur"]
        },
        "brahmi": {
            "aliases": ["brahmi", "bacopa"],
            "ingredients": ["bacopa monnieri", "brahmi", "bacopa"],
            "manufacturer": ["himalaya", "organic india", "dabur", "baidyanath"]
        },
        "trikatu": {
            "aliases": ["trikatu", "tri katu"],
            "ingredients": ["black pepper", "long pepper", "ginger", "piper nigrum", "piper longum", "zingiber"],
            "manufacturer": ["dabur", "baidyanath", "patanjali"]
        },
        "guggulu": {
            "aliases": ["guggulu", "guggul", "yograj guggulu", "kaishore guggulu", "triphala guggulu"],
            "ingredients": ["commiphora wightii", "guggul", "commiphora"],
            "manufacturer": ["dabur", "baidyanath", "patanjali", "dhootapapeshwar"]
        },
        "arjuna": {
            "aliases": ["arjuna", "arjun"],
            "ingredients": ["terminalia arjuna", "arjuna"],
            "manufacturer": ["himalaya", "organic india", "dabur"]
        },
        "shatavari": {
            "aliases": ["shatavari", "shatawari"],
            "ingredients": ["asparagus racemosus", "shatavari"],
            "manufacturer": ["himalaya", "organic india", "patanjali"]
        },
    }

    # ─── Fuzzy matching helpers ───────────────────────────────
    from difflib import SequenceMatcher

    def fuzzy_match(target: str, text: str, threshold: float = 0.65) -> bool:
        """Check if target approximately appears in text using fuzzy matching."""
        target = target.lower()
        text = text.lower()

        # Direct substring check first (fast path)
        if target in text:
            return True

        # Split text into words and n-grams, check each against target
        words = text.split()
        target_words = target.split()
        target_len = len(target_words)

        for i in range(len(words)):
            # Check single words against single-word targets
            if target_len == 1:
                for w in words:
                    ratio = SequenceMatcher(None, target, w).ratio()
                    if ratio >= threshold:
                        return True
            # Check multi-word n-grams against multi-word targets
            chunk = " ".join(words[i:i + target_len])
            ratio = SequenceMatcher(None, target, chunk).ratio()
            if ratio >= threshold:
                return True

        return False

    # Check against known formulations using fuzzy matching
    matched_formulation = None
    ingredient_matches = 0
    manufacturer_match = False

    for name, info in AUTHENTIC_FORMULATIONS.items():
        # Check formulation name AND aliases with fuzzy matching
        found = False
        for alias in info.get("aliases", [name]):
            if fuzzy_match(alias, analysis_text, threshold=0.7):
                found = True
                break
        if not found:
            continue

        matched_formulation = name
        for ing in info["ingredients"]:
            if fuzzy_match(ing, analysis_text, threshold=0.65):
                ingredient_matches += 1
        for mfg in info["manufacturer"]:
            if fuzzy_match(mfg, analysis_text, threshold=0.75):
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
            "ocr_text": ocr_text if ocr_text else None
        }
    else:
        return {
            "authenticated": False,
            "confidence": 0.2,
            "formulation": None,
            "reason": "Formulation not found in database",
            "classification": "Unknown",
            "ocr_text": ocr_text if ocr_text else None
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

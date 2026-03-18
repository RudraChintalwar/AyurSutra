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


def load_models():
    """Load ML models on startup."""
    global model, embedder, mlb, threshold

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


# ─── Request/Response models ─────────────────────────────
class PredictionRequest(BaseModel):
    symptoms: str
    dosha: str = "Unknown"
    age: int = 35
    gender: str = "Unknown"


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

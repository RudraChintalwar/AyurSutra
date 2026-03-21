# serve_fastapi.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np
from sentence_transformers import SentenceTransformer
from tensorflow import keras
import uvicorn
import os

app = FastAPI()

# Load label binarizer
mlb = joblib.load("data/mlb.joblib")

# Load trained NN model
nn_model = keras.models.load_model("models/panchakarma_nn.keras")

# Load embedding model
model_emb = SentenceTransformer("all-MiniLM-L6-v2")

# Load thresholds if available, else default 0.5
if os.path.exists("models/thresholds.joblib"):
    thresholds = joblib.load("models/thresholds.joblib")
else:
    thresholds = [0.5] * len(mlb.classes_)

class Request(BaseModel):
    symptoms: str
    dosha: str = ""
    prakriti: str = ""
    age: int | None = None
    gender: str = ""

@app.post("/predict")
def predict(req: Request):
    # Prepare input text
    text = f"{req.symptoms} | dosha: {req.dosha} | prakriti: {req.prakriti} | age: {req.age} | gender: {req.gender}"
    
    # Encode into embeddings
    emb = model_emb.encode([text], convert_to_numpy=True)
    
    # Get probabilities from NN
    probs = nn_model.predict(emb)[0]
    
    # Apply thresholds per label
    y_pred = np.array([1 if p >= t else 0 for p, t in zip(probs, thresholds)])
    
    # Decode labels
    labels = mlb.inverse_transform([y_pred])[0]
    
    # Return labels + probabilities
    results = {
        "predicted_panchakarma": labels,
        "probabilities": {cls: float(prob) for cls, prob in zip(mlb.classes_, probs)}
    }
    return results

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

import joblib
import numpy as np
import tensorflow as tf
from sentence_transformers import SentenceTransformer

# ---- Load artifacts ----
mlb = joblib.load("data/mlb.joblib")  # multilabel binarizer with class names
model = tf.keras.models.load_model("models/panchakarma_nn.keras")
model_emb = SentenceTransformer("all-MiniLM-L6-v2")

# Try to load tuned threshold
try:
    threshold = joblib.load("models/optimal_threshold.joblib")
    print(f"🔖 Using tuned threshold = {threshold:.2f}")
except:
    threshold = 0.5
    print("⚠️ No tuned threshold found, using default 0.5")

def predict_panchakarma(symptoms, dosha="", prakriti="", age=None, gender=""):
    # ---- 1. Build input text ----
    text = f"{symptoms} | dosha: {dosha} | prakriti: {prakriti} | age: {age} | gender: {gender}"

    # ---- 2. Encode with SentenceTransformer ----
    emb = model_emb.encode([text], convert_to_numpy=True)

    # ---- 3. Get probabilities from NN ----
    probs = model.predict(emb)[0]

    # ---- 4. Apply threshold ----
    y_pred = (probs >= threshold).astype(int)

    # ---- 5. Decode labels properly ----
    labels = mlb.inverse_transform(y_pred.reshape(1, -1))[0]

    return labels, {cls: float(prob) for cls, prob in zip(mlb.classes_, probs)}


if __name__ == "__main__":
    # Example interactive CLI
    symptoms = input("Enter symptoms: ")
    dosha = input("Enter dosha (optional): ")
    prakriti = input("Enter prakriti (optional): ")
    age = input("Enter age (optional): ")
    gender = input("Enter gender (optional): ")

    labels, probs = predict_panchakarma(symptoms, dosha, prakriti, age, gender)

    print("\n✅ Predicted Panchakarma therapies:", labels if labels else "None")
    print("\n📊 Probabilities:")
    for k, v in probs.items():
        print(f"{k}: {v:.3f}")

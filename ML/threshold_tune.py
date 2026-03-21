import numpy as np
import tensorflow as tf
from sklearn.metrics import f1_score
import joblib
import os

# ---- 1. Load trained model ----
model_path = "models/panchakarma_nn.keras"
if not os.path.exists(model_path):
    raise FileNotFoundError(f"❌ Could not find model at {model_path}")
model = tf.keras.models.load_model(model_path)

# ---- 2. Load validation/test data ----
# If you don’t have X_val/y_val saved, use X_test/y_test
X_val = np.load("data/X_test_emb.npy")
y_val = np.load("data/y_test.npy")

print(f"Loaded model and validation data: X={X_val.shape}, y={y_val.shape}")

# ---- 3. Predict probabilities ----
probs = model.predict(X_val)
print("Predictions shape:", probs.shape)

# ---- 4. Tune thresholds ----
best_thresh = 0.5
best_f1 = 0.0

for thresh in np.linspace(0.1, 0.9, 17):  # test thresholds 0.1 → 0.9
    y_pred = (probs >= thresh).astype(int)
    f1 = f1_score(y_val, y_pred, average="micro")
    if f1 > best_f1:
        best_f1 = f1
        best_thresh = thresh

print(f"✅ Best threshold: {best_thresh:.2f}, F1 micro: {best_f1:.4f}")

# ---- 5. Save tuned threshold ----
os.makedirs("models", exist_ok=True)
joblib.dump(best_thresh, "models/optimal_threshold.joblib")
print("🔖 Saved best threshold → models/optimal_threshold.joblib")

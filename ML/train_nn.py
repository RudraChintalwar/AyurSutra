# train_nn.py
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from sklearn.metrics import f1_score
import joblib
import os

X_train = np.load("data/X_train_emb.npy")
X_test  = np.load("data/X_test_emb.npy")
y_train = np.load("data/y_train.npy")
y_test  = np.load("data/y_test.npy")

os.makedirs("models", exist_ok=True)

input_dim = X_train.shape[1]
output_dim = y_train.shape[1]

model = models.Sequential()
model.add(layers.Dense(1024, activation="relu", input_dim=input_dim))
model.add(layers.Dropout(0.3))
model.add(layers.Dense(512, activation="relu"))
model.add(layers.Dropout(0.3))
model.add(layers.Dense(output_dim, activation="sigmoid"))
model.compile(optimizer="adam", loss="binary_crossentropy", metrics=[])

es = callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True)
model.fit(X_train, y_train, validation_split=0.1, epochs=30, batch_size=256, callbacks=[es])

# predict and threshold at 0.5 (tune threshold later)
y_pred = (model.predict(X_test) >= 0.5).astype(int)

print("F1 micro:", f1_score(y_test, y_pred, average="micro"))
print("F1 macro:", f1_score(y_test, y_pred, average="macro"))

model.save("models/panchakarma_nn.keras")
print("Saved Keras model to models/panchakarma_nn.keras")

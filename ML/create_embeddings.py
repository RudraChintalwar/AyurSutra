# create_embeddings.py
import numpy as np
from sentence_transformers import SentenceTransformer
import math
from tqdm import tqdm

model_name = "all-MiniLM-L6-v2"   # fast; swap for more accuracy if you want
model = SentenceTransformer(model_name)

X_train = np.load("data/X_train_text.npy", allow_pickle=True)
X_test  = np.load("data/X_test_text.npy", allow_pickle=True)

def encode_and_save(X, out_path, batch_size=128):
    n = len(X)
    embeddings = []
    for i in tqdm(range(0, n, batch_size)):
        batch = X[i:i+batch_size].tolist()
        emb = model.encode(batch, show_progress_bar=False, convert_to_numpy=True, batch_size=batch_size)
        embeddings.append(emb)
    embeddings = np.vstack(embeddings)
    np.save(out_path, embeddings)
    print("Saved", out_path, embeddings.shape)

encode_and_save(X_train, "data/X_train_emb.npy", batch_size=128)
encode_and_save(X_test,  "data/X_test_emb.npy",  batch_size=128)

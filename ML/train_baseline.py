# train_baseline.py
import numpy as np
from sklearn.multiclass import OneVsRestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, classification_report
import joblib

X_train = np.load("data/X_train_emb.npy")
X_test  = np.load("data/X_test_emb.npy")
y_train = np.load("data/y_train.npy")
y_test  = np.load("data/y_test.npy")

# simple logistic baseline (One-vs-Rest)
clf = OneVsRestClassifier(LogisticRegression(solver="saga", max_iter=1000, n_jobs=-1))
clf.fit(X_train, y_train)

# predict
y_pred = clf.predict(X_test)

print("F1 (micro):", f1_score(y_test, y_pred, average="micro"))
print("F1 (macro):", f1_score(y_test, y_pred, average="macro"))
print(classification_report(y_test, y_pred))

# save
joblib.dump(clf, "models/baseline_clf.joblib")
print("saved models/baseline_clf.joblib")

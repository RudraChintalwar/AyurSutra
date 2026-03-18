"""
AyurSutra — Train Random Forest Models
Trains RF Classifier (severity scoring) and RF Regressor (session prediction)
using synthetic Panchakarma treatment data.

Run: python train_models.py
"""
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split

np.random.seed(42)

# ─── Synthetic Training Data ─────────────────────────────
# Symptoms encoded as severity vectors (pain, inflammation, fatigue, digestive, stress)
N = 500

def generate_severity_data(n):
    """Generate synthetic data for severity classification."""
    X = []
    y = []
    dosha_map = {"Vata": 0, "Pitta": 1, "Kapha": 2}
    
    for _ in range(n):
        pain = np.random.randint(0, 11)
        inflammation = np.random.randint(0, 11)
        fatigue = np.random.randint(0, 11)
        digestive = np.random.randint(0, 11)
        stress = np.random.randint(0, 11)
        dosha = np.random.choice([0, 1, 2])
        
        # Severity formula: weighted combination
        raw_severity = (pain * 0.25 + inflammation * 0.25 + fatigue * 0.15 + 
                       digestive * 0.2 + stress * 0.15)
        # Add some noise
        raw_severity += np.random.normal(0, 0.5)
        severity = int(np.clip(np.round(raw_severity), 1, 10))
        
        X.append([pain, inflammation, fatigue, digestive, stress, dosha])
        y.append(severity)
    
    return np.array(X), np.array(y)


def generate_session_data(n):
    """Generate synthetic data for session count/duration prediction."""
    X = []
    y_sessions = []
    y_duration = []
    
    for _ in range(n):
        severity = np.random.randint(1, 11)
        dosha = np.random.choice([0, 1, 2])
        age = np.random.randint(18, 75)
        gender = np.random.choice([0, 1])  # 0=Female, 1=Male
        
        # Session count: higher severity = more sessions
        base_sessions = 1 + severity * 0.6
        base_sessions += np.random.normal(0, 0.5)
        sessions = int(np.clip(np.round(base_sessions), 2, 7))
        
        # Duration: depends on therapy complexity (correlated with severity)
        base_duration = 30 + severity * 8 + (age > 50) * 15
        base_duration += np.random.normal(0, 10)
        duration = int(np.clip(base_duration, 30, 120))
        
        X.append([severity, dosha, age, gender])
        y_sessions.append(sessions)
        y_duration.append(duration)
    
    return np.array(X), np.array(y_sessions), np.array(y_duration)


if __name__ == "__main__":
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    # ─── Train RF Classifier (Severity) ──────────────────
    print("Training RF Classifier for severity scoring...")
    X_sev, y_sev = generate_severity_data(N)
    X_train, X_test, y_train, y_test = train_test_split(X_sev, y_sev, test_size=0.2, random_state=42)
    
    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X_train, y_train)
    accuracy = clf.score(X_test, y_test)
    print(f"  ✅ RF Classifier accuracy: {accuracy:.2%}")
    
    clf_path = os.path.join(models_dir, "severity_clf.joblib")
    joblib.dump(clf, clf_path)
    print(f"  ✅ Saved to {clf_path}")
    
    # ─── Train RF Regressor (Session Count) ──────────────
    print("\nTraining RF Regressor for session prediction...")
    X_sess, y_sessions, y_duration = generate_session_data(N)
    X_train, X_test, y_train_s, y_test_s = train_test_split(X_sess, y_sessions, test_size=0.2, random_state=42)
    _, _, y_train_d, y_test_d = train_test_split(X_sess, y_duration, test_size=0.2, random_state=42)
    
    reg_sessions = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    reg_sessions.fit(X_train, y_train_s)
    r2_s = reg_sessions.score(X_test, y_test_s)
    print(f"  ✅ RF Regressor (sessions) R²: {r2_s:.3f}")
    
    reg_duration = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    reg_duration.fit(X_train, y_train_d)
    r2_d = reg_duration.score(X_test, y_test_d)
    print(f"  ✅ RF Regressor (duration) R²: {r2_d:.3f}")
    
    sess_path = os.path.join(models_dir, "session_regressor.joblib")
    dur_path = os.path.join(models_dir, "duration_regressor.joblib")
    joblib.dump(reg_sessions, sess_path)
    joblib.dump(reg_duration, dur_path)
    print(f"  ✅ Saved to {sess_path}")
    print(f"  ✅ Saved to {dur_path}")
    
    print("\n🎉 All models trained and saved successfully!")

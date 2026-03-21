# prepare_data.py
import pandas as pd
import numpy as np
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.model_selection import train_test_split
import joblib
import json

IN_CSV = "panchakarma_dataset_200k.csv"  # path to the CSV we created earlier
OUT_PREFIX = "data/panchakarma"          # will create data/ folder

def clean_symptoms(s):
    # simple normalization; you can expand
    return " ; ".join([x.strip().lower() for x in s.split(";")])

def main():
    df = pd.read_csv(IN_CSV)
    # create combined text: symptoms + dosha + prakriti + age + gender (as text)
    df['symptoms_clean'] = df['symptoms'].fillna("").apply(clean_symptoms)
    df['text_input'] = (
        df['symptoms_clean'].astype(str) +
        " | dosha: " + df['dosha'].fillna("unknown").astype(str) +
        " | prakriti: " + df['prakriti'].fillna("unknown").astype(str) +
        " | age: " + df['age'].astype(str) +
        " | gender: " + df['gender'].astype(str)
    )

    # multi-label encode recommended panchakarma
    df['pk_list'] = df['recommended_panchakarma'].fillna("").apply(lambda x: [s.strip() for s in x.split(";") if s.strip()])

    mlb = MultiLabelBinarizer()
    Y = mlb.fit_transform(df['pk_list'])
    print("Panchakarma classes:", mlb.classes_)

    X = df['text_input'].tolist()

    # train/test split - randomized
    X_train, X_test, y_train, y_test = train_test_split(X, Y, test_size=0.2, random_state=42, shuffle=True)

    # save arrays and mlb
    import os
    os.makedirs("data", exist_ok=True)
    joblib.dump(mlb, "data/mlb.joblib")
    np.save("data/X_train_text.npy", np.array(X_train, dtype=object))
    np.save("data/X_test_text.npy", np.array(X_test, dtype=object))
    np.save("data/y_train.npy", y_train)
    np.save("data/y_test.npy", y_test)
    print("Saved preprocessed data to data/")

if __name__ == "__main__":
    main()

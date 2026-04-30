from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

from scripts.pipeline_utils import iter_jsonl, repo_root_from, write_json


def load_processed_records(root: Path, sources: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for src in sources:
        path = root / "data" / "processed" / f"{src}.jsonl"
        if not path.exists():
            continue
        out.extend(list(iter_jsonl(path)))
    return out


def safe_text(rec: Dict[str, Any]) -> str:
    return str(rec.get("text") or "").strip()


def train_vote_stance(records: List[Dict[str, Any]], model_dir: Path) -> Dict[str, Any]:
    dataset = [
        (safe_text(r), str(r.get("vote_stance") or "unknown"))
        for r in records
        if safe_text(r) and str(r.get("vote_stance") or "unknown") not in {"unknown", "no_vote_context"}
    ]
    if len(dataset) < 20:
        return {"status": "skipped", "reason": "insufficient labelled vote_stance samples", "samples": len(dataset)}

    label_counts: Dict[str, int] = {}
    for _, label in dataset:
        label_counts[label] = label_counts.get(label, 0) + 1

    cleaned = [(x, y) for x, y in dataset if label_counts.get(y, 0) >= 2]
    dropped = len(dataset) - len(cleaned)
    if len(cleaned) < 20:
        return {
            "status": "skipped",
            "reason": "insufficient vote_stance samples after dropping singleton classes",
            "samples": len(cleaned),
            "dropped_singleton_labels": dropped,
            "label_counts": label_counts,
        }

    X = [x for x, _ in cleaned]
    y = [y for _, y in cleaned]
    stratify = y if len(set(y)) > 1 and min(label_counts.get(lbl, 0) for lbl in set(y)) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=stratify)

    clf = Pipeline(
        [
            ("tfidf", TfidfVectorizer(max_features=20000, ngram_range=(1, 2), min_df=2)),
            ("lr", LogisticRegression(max_iter=400, class_weight="balanced")),
        ]
    )
    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)
    report = classification_report(y_test, preds, output_dict=True, zero_division=0)
    f1 = f1_score(y_test, preds, average="weighted", zero_division=0)

    out_path = model_dir / "vote_stance_model.joblib"
    joblib.dump(clf, out_path)
    return {
        "status": "ok",
        "samples": len(cleaned),
        "labels": sorted(set(y)),
        "weighted_f1": float(f1),
        "classification_report": report,
        "model_path": str(out_path),
        "dropped_singleton_labels": dropped,
        "label_counts": label_counts,
    }


def train_speech_acts(records: List[Dict[str, Any]], model_dir: Path) -> Dict[str, Any]:
    dataset = []
    for r in records:
        txt = safe_text(r)
        acts = [str(a) for a in (r.get("speech_acts") or []) if str(a) and str(a) != "unknown"]
        if txt and acts:
            dataset.append((txt, sorted(set(acts))))
    if len(dataset) < 20:
        return {"status": "skipped", "reason": "insufficient labelled speech_acts samples", "samples": len(dataset)}

    X = [x for x, _ in dataset]
    y_raw = [a for _, a in dataset]
    mlb = MultiLabelBinarizer()
    Y = mlb.fit_transform(y_raw)
    if Y.shape[1] == 0:
        return {"status": "skipped", "reason": "no speech act classes after binarization", "samples": len(dataset)}

    X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, random_state=42)
    vec = TfidfVectorizer(max_features=25000, ngram_range=(1, 2), min_df=2)
    Xtr = vec.fit_transform(X_train)
    Xte = vec.transform(X_test)
    clf = OneVsRestClassifier(LogisticRegression(max_iter=400, class_weight="balanced"))
    clf.fit(Xtr, Y_train)
    pred = clf.predict(Xte)
    micro_f1 = f1_score(Y_test, pred, average="micro", zero_division=0)
    macro_f1 = f1_score(Y_test, pred, average="macro", zero_division=0)

    bundle = {"vectorizer": vec, "classifier": clf, "label_binarizer": mlb}
    out_path = model_dir / "speech_acts_model.joblib"
    joblib.dump(bundle, out_path)
    return {
        "status": "ok",
        "samples": len(dataset),
        "label_count": int(Y.shape[1]),
        "labels": list(mlb.classes_),
        "micro_f1": float(micro_f1),
        "macro_f1": float(macro_f1),
        "model_path": str(out_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train lightweight transfer models from processed BOTC schema corpus.")
    parser.add_argument(
        "--sources",
        default="werewolf_among_us,llmafia,aiwolf",
        help="Comma-separated processed source names.",
    )
    parser.add_argument("--model-dir", default="models")
    parser.add_argument("--report-path", default="models/training_report.json")
    args = parser.parse_args()

    root = repo_root_from(__file__)
    model_dir = root / args.model_dir
    model_dir.mkdir(parents=True, exist_ok=True)
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    records = load_processed_records(root, sources)

    vote_report = train_vote_stance(records, model_dir=model_dir)
    acts_report = train_speech_acts(records, model_dir=model_dir)

    report = {
        "sources": sources,
        "record_count": len(records),
        "vote_stance_model": vote_report,
        "speech_acts_model": acts_report,
    }
    out_path = root / args.report_path
    write_json(out_path, report)
    print(json.dumps({"output": str(out_path), **report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

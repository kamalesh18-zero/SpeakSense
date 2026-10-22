"""Ground-truth validation evaluator computing Precision, Recall, F1, and Temporal IoU."""
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np

from app.database import get_all_recordings, get_annotations_for_sample
from app.audio.processor import decode_and_resample
from app.alignment.forced_aligner import transcribe_and_align
from app.features.extractor import extract_all_features
from app.comparison.comparator import align_and_contrast_words
from app.flaws.detector import detect_temporal_flaws
from app.models.schemas import BenchmarkMetrics

def compute_interval_iou(start1: float, end1: float, start2: float, end2: float) -> float:
    """Computes temporal Intersection over Union (IoU) between two time spans."""
    intersection_start = max(start1, start2)
    intersection_end = min(end1, end2)
    intersection = max(0.0, intersection_end - intersection_start)

    union_start = min(start1, start2)
    union_end = max(end1, end2)
    union = max(1e-6, union_end - union_start)

    return float(intersection / union)

def evaluate_flaw_detection_benchmark(split_filter: str = "test") -> BenchmarkMetrics:
    """
    Runs automated evaluation of the flaw detection engine against
    ground-truth annotations on the specified split (e.g., 'test' or 'all').
    """
    recordings = get_all_recordings()
    if split_filter != "all":
        target_recordings = [r for r in recordings if r["split"] == split_filter and not r["is_reference"]]
    else:
        target_recordings = [r for r in recordings if not r["is_reference"]]

    total_gt = 0
    total_detected = 0
    true_positives = 0
    false_positives = 0
    false_negatives = 0

    iou_list: List[float] = []
    boundary_errors: List[float] = []

    # Map references for scripts
    ref_map = {r["script_id"]: r for r in recordings if r["is_reference"]}

    for rec in target_recordings:
        ref_rec = ref_map.get(rec["script_id"])
        if not ref_rec:
            continue

        gt_annotations = get_annotations_for_sample(rec["id"])
        total_gt += len(gt_annotations)

        # Run pipeline
        ref_y, ref_sr, ref_meta = decode_and_resample(ref_rec["audio_path"])
        part_y, part_sr, part_meta = decode_and_resample(rec["audio_path"])

        from app.database import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT transcript FROM scripts WHERE id = ?", (rec["script_id"],))
        script_row = cursor.fetchone()
        conn.close()
        transcript = script_row["transcript"] if script_row else ""

        # Alignment & Features
        ref_align, ref_words = transcribe_and_align(ref_y, transcript, ref_sr)
        part_align, part_words = transcribe_and_align(part_y, transcript, part_sr)

        ref_features = extract_all_features(ref_rec["id"], ref_rec["audio_path"], ref_words, ref_y, ref_sr, ref_meta)
        part_features = extract_all_features(rec["id"], rec["audio_path"], part_words, part_y, part_sr, part_meta)

        contrasts = align_and_contrast_words(ref_words, part_words)
        detected_flaws = detect_temporal_flaws(ref_features, part_features, contrasts)
        total_detected += len(detected_flaws)

        # Match detected flaws against ground truth
        matched_gt = set()
        for d in detected_flaws:
            best_iou = 0.0
            best_gt_idx = -1
            best_b_err = 0.0

            for idx, gt in enumerate(gt_annotations):
                if idx in matched_gt:
                    continue
                # Same category match (or general temporal flaw overlap)
                if d.flaw_type == gt["flaw_category"] or "pause" in d.flaw_type and "pause" in gt["flaw_category"]:
                    iou = compute_interval_iou(d.start_time, d.end_time, gt["flaw_start"], gt["flaw_end"])
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = idx
                        b_err = (abs(d.start_time - gt["flaw_start"]) + abs(d.end_time - gt["flaw_end"])) / 2.0
                        best_b_err = b_err

            if best_iou >= 0.20 and best_gt_idx >= 0:
                true_positives += 1
                matched_gt.add(best_gt_idx)
                iou_list.append(best_iou)
                boundary_errors.append(best_b_err)
            else:
                false_positives += 1

        false_negatives += (len(gt_annotations) - len(matched_gt))

    # Calculate final precision, recall, F1
    precision = round(true_positives / (true_positives + false_positives), 3) if (true_positives + false_positives) > 0 else 0.0
    recall = round(true_positives / (true_positives + false_negatives), 3) if (true_positives + false_negatives) > 0 else 0.0
    f1 = round((2 * precision * recall) / (precision + recall + 1e-6), 3) if (precision + recall) > 0 else 0.0
    mean_iou = round(float(np.mean(iou_list)), 3) if iou_list else 0.0
    mean_err = round(float(np.mean(boundary_errors)), 3) if boundary_errors else 0.0

    return BenchmarkMetrics(
        total_samples=len(target_recordings),
        ground_truth_flaw_count=total_gt,
        detected_flaw_count=total_detected,
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        precision=precision,
        recall=recall,
        f1_score=f1,
        temporal_mean_iou=mean_iou,
        mean_boundary_error_sec=mean_err,
        evaluated_at=datetime.utcnow().isoformat()
    )

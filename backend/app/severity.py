"""
Pavement Distress & Civil Engineering Severity Engine
Compliant with principles derived from ASTM D6433 (Standard Practice for Roads and Parking Lots Pavement Condition Index Surveys)
"""
from typing import List, Tuple, Dict, Any
from .config import (
    ASPHALT_DENSITY_KG_PER_M3,
    AVERAGE_POTHOLE_DEPTH_M,
    COST_PER_TON_ASPHALT_USD,
    USD_TO_INR_RATE
)

def calculate_defect_metrics(boxes: List[List[float]], image_width: int, image_height: int) -> Dict[str, Any]:
    """
    Analyzes detected pothole/defect bounding boxes to produce comprehensive
    civil engineering metrics, severity classifications, and repair estimates.
    
    boxes: list of [x1, y1, x2, y2]
    image_width: width of image in px
    image_height: height of image in px
    """
    image_area = image_width * image_height
    if image_area <= 0 or not boxes:
        return {
            "defect_count": 0,
            "coverage_percent": 0.0,
            "severity": "NONE",
            "pci_score": 100,
            "pci_rating": "Good / Pristine",
            "hazard_index": 0,
            "speed_advisory_mph": 60,
            "estimated_surface_area_m2": 0.0,
            "estimated_asphalt_tons": 0.0,
            "estimated_cost_usd": 0.0,
            "estimated_cost_inr": 0.0,
            "recommended_action": "No structural repairs needed. Roadway in safe operating condition.",
            "urgency_code": "P4 - Routine Monitoring",
            "boxes_detail": []
        }

    total_box_area = 0.0
    boxes_detail = []

    # Dashcam typical field of view heuristic:
    # A standard 1080p/720p dashcam capturing road surface covers roughly 12m x 3.6m lane (43.2 m^2) in lower road horizon.
    # Therefore, 1 square pixel roughly maps to (43.2 / (width * height * 0.7)) m^2.
    pixel_to_m2_factor = 40.0 / (image_area * 0.7)

    for idx, (x1, y1, x2, y2) in enumerate(boxes):
        w = max(0.0, float(x2 - x1))
        h = max(0.0, float(y2 - y1))
        box_area = w * h
        total_box_area += box_area

        # Physical dimension approximation
        est_area_m2 = round(box_area * pixel_to_m2_factor, 3)
        depth_m = AVERAGE_POTHOLE_DEPTH_M * (1.0 + (h / max(1.0, float(image_height)) * 0.8))
        est_volume_m3 = round(est_area_m2 * depth_m, 4)
        est_asphalt_kg = round(est_volume_m3 * ASPHALT_DENSITY_KG_PER_M3, 1)

        # Individual box severity
        box_cov_pct = (box_area / image_area) * 100.0
        if box_cov_pct < 2.0:
            box_sev = "LOW"
        elif box_cov_pct < 6.0:
            box_sev = "MEDIUM"
        elif box_cov_pct < 14.0:
            box_sev = "HIGH"
        else:
            box_sev = "CRITICAL"

        boxes_detail.append({
            "id": idx + 1,
            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            "width_px": round(w, 1),
            "height_px": round(h, 1),
            "area_px": round(box_area, 1),
            "coverage_percent": round(box_cov_pct, 2),
            "estimated_area_m2": est_area_m2,
            "estimated_volume_m3": est_volume_m3,
            "asphalt_required_kg": est_asphalt_kg,
            "severity": box_sev
        })

    # Coverage calculation (capped at 100%)
    coverage_percent = min(100.0, (total_box_area / image_area) * 100.0)

    # ASTM D6433 inspired Severity classification
    if coverage_percent < 2.5 and len(boxes) <= 1:
        severity = "LOW"
        pci_deduct = 12 + (coverage_percent * 4)
        urgency = "P3 - Scheduled Maintenance (Within 30 Days)"
        recommended_action = "Throw-and-roll cold patch repair; seal perimeter joints against moisture intrusion."
        hazard_index = 25
        speed_advisory = 45
    elif coverage_percent < 8.0:
        severity = "MEDIUM"
        pci_deduct = 30 + (coverage_percent * 3.5)
        urgency = "P2 - Priority Maintenance (Within 7 Days)"
        recommended_action = "Semi-permanent sawcut patch with hot-mix asphalt (HMA) compaction; emulsion tack coat."
        hazard_index = 55
        speed_advisory = 30
    elif coverage_percent < 18.0:
        severity = "HIGH"
        pci_deduct = 55 + (coverage_percent * 2.0)
        urgency = "P1 - Urgent Civil Repair (Within 48 Hours)"
        recommended_action = "Deep mill and inlay patching; structural sub-base compaction; deploy caution pylons."
        hazard_index = 80
        speed_advisory = 20
    else:
        severity = "CRITICAL"
        pci_deduct = 75 + (coverage_percent * 1.5)
        urgency = "P0 - Emergency Hazard (Immediate Dispatch / Lane Closure)"
        recommended_action = "Full-depth asphalt reclamation (FDR); base stabilization; emergency traffic detour."
        hazard_index = 96
        speed_advisory = 10

    # Pavement Condition Index (PCI: 0 - 100)
    pci_score = max(5, min(100, round(100.0 - pci_deduct)))
    if pci_score >= 85:
        pci_rating = "Good"
    elif pci_score >= 70:
        pci_rating = "Satisfactory"
    elif pci_score >= 55:
        pci_rating = "Fair"
    elif pci_score >= 40:
        pci_rating = "Poor"
    elif pci_score >= 25:
        pci_rating = "Very Poor"
    else:
        pci_rating = "Failed / Hazardous"

    # Aggregated civil cost and material estimates
    total_area_m2 = sum(b["estimated_area_m2"] for b in boxes_detail)
    total_volume_m3 = sum(b["estimated_volume_m3"] for b in boxes_detail)
    total_asphalt_kg = sum(b["asphalt_required_kg"] for b in boxes_detail)
    total_asphalt_tons = round(total_asphalt_kg / 1000.0, 3)
    
    # Financial estimation: base setup cost + tonnage cost + machinery/labor mobilization
    mobilization_fee_usd = 65.0 if severity in ["LOW", "MEDIUM"] else 140.0
    material_cost_usd = total_asphalt_tons * COST_PER_TON_ASPHALT_USD * 1.45  # includes sealant & binder
    total_cost_usd = round(mobilization_fee_usd + material_cost_usd, 2)
    total_cost_inr = round(total_cost_usd * USD_TO_INR_RATE, 2)

    return {
        "defect_count": len(boxes),
        "coverage_percent": round(coverage_percent, 2),
        "severity": severity,
        "pci_score": pci_score,
        "pci_rating": pci_rating,
        "hazard_index": hazard_index,
        "speed_advisory_mph": speed_advisory,
        "estimated_surface_area_m2": round(total_area_m2, 2),
        "estimated_volume_m3": round(total_volume_m3, 3),
        "estimated_asphalt_tons": total_asphalt_tons,
        "estimated_cost_usd": total_cost_usd,
        "estimated_cost_inr": total_cost_inr,
        "recommended_action": recommended_action,
        "urgency_code": urgency,
        "boxes_detail": boxes_detail
    }

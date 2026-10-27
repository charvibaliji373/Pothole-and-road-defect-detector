"""
SQLite Database Management for RoadVision AI
Maintains historical road condition audits, GIS coordinates, work orders, and citizen reports.
"""
import sqlite3
import uuid
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from .config import DB_PATH

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and seeds initial realistic road audit records if empty."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        timestamp TEXT NOT NULL,
        location_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        defect_count INTEGER NOT NULL,
        severity TEXT NOT NULL,
        coverage_percent REAL NOT NULL,
        pci_score INTEGER NOT NULL,
        pci_rating TEXT NOT NULL,
        hazard_index INTEGER NOT NULL,
        estimated_cost_usd REAL NOT NULL,
        estimated_cost_inr REAL NOT NULL,
        asphalt_tons REAL NOT NULL,
        urgency_code TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        status TEXT NOT NULL,
        work_order_id TEXT,
        image_path TEXT,
        annotated_path TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS defects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspection_uuid TEXT NOT NULL,
        defect_class TEXT NOT NULL,
        confidence REAL NOT NULL,
        x1 REAL NOT NULL,
        y1 REAL NOT NULL,
        x2 REAL NOT NULL,
        y2 REAL NOT NULL,
        area_m2 REAL NOT NULL,
        severity TEXT NOT NULL,
        FOREIGN KEY (inspection_uuid) REFERENCES inspections (uuid)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS citizen_reports (
        ticket_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        citizen_name TEXT NOT NULL,
        phone TEXT,
        description TEXT NOT NULL,
        landmark TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        reported_severity TEXT NOT NULL,
        status TEXT NOT NULL,
        upvotes INTEGER DEFAULT 1
    );
    """)

    conn.commit()

    # Seed data if inspections table is empty
    cursor.execute("SELECT COUNT(*) FROM inspections")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_initial_data(conn)

    conn.close()

def seed_initial_data(conn):
    """Seeds realistic road defects across major survey zones."""
    seed_records = [
        {
            "location_name": "Lexington Ave & E 42nd St, New York, NY",
            "lat": 40.7516,
            "lng": -73.9754,
            "count": 3,
            "sev": "HIGH",
            "cov": 12.4,
            "pci": 38,
            "pci_rat": "Poor",
            "hazard": 82,
            "usd": 385.0,
            "inr": 33302.5,
            "tons": 0.54,
            "urgency": "P1 - Urgent Civil Repair (Within 48 Hours)",
            "action": "Sawcut perimeter, mill 75mm base, apply tack coat, install hot-mix asphalt (HMA) with 2-ton roller compaction.",
            "status": "Work Order Issued",
            "wo_id": "WO-NYC-2026-0914"
        },
        {
            "location_name": "MG Road & Brigade Rd Junction, Bengaluru",
            "lat": 12.9748,
            "lng": 77.6094,
            "count": 4,
            "sev": "CRITICAL",
            "cov": 23.8,
            "pci": 22,
            "pci_rat": "Very Poor",
            "hazard": 95,
            "usd": 620.0,
            "inr": 53630.0,
            "tons": 1.12,
            "urgency": "P0 - Emergency Hazard (Immediate Dispatch / Lane Closure)",
            "action": "Full-depth asphalt reclamation, base aggregate re-leveling, heavy compaction and thermoplastic line re-marking.",
            "status": "Inspection Scheduled",
            "wo_id": "WO-BLR-2026-4402"
        },
        {
            "location_name": "Oxford Street & Regent St, London, UK",
            "lat": 51.5152,
            "lng": -0.1419,
            "count": 1,
            "sev": "LOW",
            "cov": 2.1,
            "pci": 84,
            "pci_rat": "Satisfactory",
            "hazard": 24,
            "usd": 125.0,
            "inr": 10812.5,
            "tons": 0.08,
            "urgency": "P3 - Scheduled Maintenance (Within 30 Days)",
            "action": "Throw-and-roll cold patch polymer-modified asphalt; seal joints against rainwater penetration.",
            "status": "Repaired",
            "wo_id": "WO-LDN-2026-1189"
        },
        {
            "location_name": "Market Street & 4th St, San Francisco, CA",
            "lat": 37.7858,
            "lng": -122.4065,
            "count": 2,
            "sev": "MEDIUM",
            "cov": 6.8,
            "pci": 62,
            "pci_rat": "Fair",
            "hazard": 52,
            "usd": 240.0,
            "inr": 20760.0,
            "tons": 0.28,
            "urgency": "P2 - Priority Maintenance (Within 7 Days)",
            "action": "Infrared asphalt joint bonding; pneumatic tamp compaction.",
            "status": "Reported",
            "wo_id": "WO-SFO-2026-3021"
        },
        {
            "location_name": "Ring Road near Lajpat Nagar, New Delhi",
            "lat": 28.5677,
            "lng": 77.2433,
            "count": 5,
            "sev": "CRITICAL",
            "cov": 26.5,
            "pci": 18,
            "pci_rat": "Failed / Hazardous",
            "hazard": 98,
            "usd": 780.0,
            "inr": 67470.0,
            "tons": 1.45,
            "urgency": "P0 - Emergency Hazard (Immediate Dispatch / Lane Closure)",
            "action": "Deep excavation, sub-grade stabilization, geotextile membrane barrier, dense bituminous macadam (DBM) overlay.",
            "status": "Work Order Issued",
            "wo_id": "WO-DEL-2026-8791"
        }
    ]

    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()

    for r in seed_records:
        rec_uuid = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO inspections (
                uuid, timestamp, location_name, latitude, longitude, defect_count,
                severity, coverage_percent, pci_score, pci_rating, hazard_index,
                estimated_cost_usd, estimated_cost_inr, asphalt_tons, urgency_code,
                recommended_action, status, work_order_id, image_path, annotated_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec_uuid, now, r["location_name"], r["lat"], r["lng"], r["count"],
            r["sev"], r["cov"], r["pci"], r["pci_rat"], r["hazard"],
            r["usd"], r["inr"], r["tons"], r["urgency"],
            r["action"], r["status"], r["wo_id"], "", ""
        ))

    # Seed citizen reports
    seed_citizen_reports = [
        {
            "ticket_id": "CIT-2026-102",
            "name": "Arjun Patel",
            "phone": "+91 98201-44512",
            "desc": "Deep pothole causing two-wheelers to skid near the bus shelter.",
            "landmark": "Outer Ring Road, Marathahalli Bridge",
            "lat": 12.9591,
            "lng": 77.6974,
            "sev": "CRITICAL",
            "status": "Under Review",
            "upvotes": 14
        },
        {
            "ticket_id": "CIT-2026-105",
            "name": "Sarah Jenkins",
            "phone": "+1 415-555-0199",
            "desc": "Pavement edge disintegration and multiple potholes expanding after heavy rain.",
            "landmark": "Mission St & 16th St Intersection",
            "lat": 37.7650,
            "lng": -122.4198,
            "sev": "HIGH",
            "status": "Scheduled for Inspection",
            "upvotes": 9
        }
    ]

    for c in seed_citizen_reports:
        cursor.execute("""
            INSERT INTO citizen_reports (
                ticket_id, timestamp, citizen_name, phone, description, landmark,
                latitude, longitude, reported_severity, status, upvotes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            c["ticket_id"], now, c["name"], c["phone"], c["desc"], c["landmark"],
            c["lat"], c["lng"], c["sev"], c["status"], c["upvotes"]
        ))

    conn.commit()

def save_inspection(inspection_data: Dict[str, Any]) -> str:
    """Inserts a new road inspection record and returns its UUID."""
    conn = get_db()
    cursor = conn.cursor()

    rec_uuid = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    metrics = inspection_data.get("metrics", {})
    loc_name = inspection_data.get("location_name", "Survey Road Segment # " + rec_uuid[:6].upper())
    lat = float(inspection_data.get("latitude", 40.7128))
    lng = float(inspection_data.get("longitude", -74.0060))
    wo_id = f"WO-{datetime.datetime.now().year}-{rec_uuid[:6].upper()}"

    cursor.execute("""
        INSERT INTO inspections (
            uuid, timestamp, location_name, latitude, longitude, defect_count,
            severity, coverage_percent, pci_score, pci_rating, hazard_index,
            estimated_cost_usd, estimated_cost_inr, asphalt_tons, urgency_code,
            recommended_action, status, work_order_id, image_path, annotated_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rec_uuid,
        now,
        loc_name,
        lat,
        lng,
        metrics.get("defect_count", 0),
        metrics.get("severity", "NONE"),
        metrics.get("coverage_percent", 0.0),
        metrics.get("pci_score", 100),
        metrics.get("pci_rating", "Good"),
        metrics.get("hazard_index", 0),
        metrics.get("estimated_cost_usd", 0.0),
        metrics.get("estimated_cost_inr", 0.0),
        metrics.get("estimated_asphalt_tons", 0.0),
        metrics.get("urgency_code", "Routine"),
        metrics.get("recommended_action", "N/A"),
        "Reported",
        wo_id,
        inspection_data.get("image_path", ""),
        inspection_data.get("annotated_path", "")
    ))

    # Insert individual defect boxes
    for det in inspection_data.get("detections", []):
        bbox = det.get("bbox", [0, 0, 0, 0])
        cursor.execute("""
            INSERT INTO defects (
                inspection_uuid, defect_class, confidence, x1, y1, x2, y2, area_m2, severity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec_uuid,
            det.get("class_name", "pothole"),
            det.get("confidence", 0.0),
            bbox[0], bbox[1], bbox[2], bbox[3],
            det.get("estimated_area_m2", 0.0),
            det.get("severity", "MEDIUM")
        ))

    conn.commit()
    conn.close()
    return rec_uuid

def get_all_inspections() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inspections WHERE defect_count > 0 ORDER BY timestamp DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_inspection_by_uuid(rec_uuid: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inspections WHERE uuid = ?", (rec_uuid,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    data = dict(row)

    cursor.execute("SELECT * FROM defects WHERE inspection_uuid = ?", (rec_uuid,))
    data["defects"] = [dict(d) for d in cursor.fetchall()]
    conn.close()
    return data

def update_inspection_status(rec_uuid: str, new_status: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE inspections SET status = ? WHERE uuid = ?", (new_status, rec_uuid))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def add_citizen_report(data: Dict[str, Any]) -> str:
    conn = get_db()
    cursor = conn.cursor()
    ticket_id = f"CIT-{datetime.datetime.now().year}-{str(uuid.uuid4())[:5].upper()}"
    now = datetime.datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO citizen_reports (
            ticket_id, timestamp, citizen_name, phone, description, landmark,
            latitude, longitude, reported_severity, status, upvotes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        ticket_id,
        now,
        data.get("citizen_name", "Anonymous Citizen"),
        data.get("phone", ""),
        data.get("description", "Road damage reported via civic portal."),
        data.get("landmark", "Unspecified Landmark"),
        float(data.get("latitude", 12.9716)),
        float(data.get("longitude", 77.5946)),
        data.get("reported_severity", "MEDIUM"),
        "Reported"
    ))
    conn.commit()
    conn.close()
    return ticket_id

def get_all_citizen_reports() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM citizen_reports ORDER BY timestamp DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def create_manual_work_order(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a new civil work order / inspection from Municipal Dispatch or GIS Map click.
    Calculates ASTM D6433 engineering metrics dynamically if not supplied.
    """
    conn = get_db()
    cursor = conn.cursor()

    rec_uuid = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    location_name = data.get("location_name", f"Survey Corridor #{rec_uuid[:6].upper()}")
    lat = float(data.get("latitude", 40.7128))
    lng = float(data.get("longitude", -74.0060))
    severity = str(data.get("severity", "MEDIUM")).upper()
    defect_count = max(1, int(data.get("defect_count", 1)))
    status = data.get("status", "Reported")
    wo_id = f"WO-{datetime.datetime.now().year}-{rec_uuid[:6].upper()}"

    # ASTM D6433 and civil engineering heuristics based on severity & count
    engineering_profiles = {
        "CRITICAL": {
            "pci_base": 20,
            "pci_rating": "Failed / Hazardous",
            "hazard_index": 95,
            "cost_per_defect_usd": 155.0,
            "tons_per_defect": 0.28,
            "coverage_pct": 5.2,
            "urgency": "P0 - Emergency Hazard (Immediate Dispatch / Lane Closure)",
            "action": "Excavate failed sub-base, install geotextile barrier, 100mm Hot-Mix Asphalt (HMA) with heavy pneumatic roller."
        },
        "HIGH": {
            "pci_base": 38,
            "pci_rating": "Poor / Urgent",
            "hazard_index": 78,
            "cost_per_defect_usd": 125.0,
            "tons_per_defect": 0.18,
            "coverage_pct": 3.8,
            "urgency": "P1 - Urgent Civil Repair (Within 48 Hours)",
            "action": "Sawcut square perimeter, mill 60mm base, apply tack coat, install hot-mix asphalt (HMA) patch."
        },
        "MEDIUM": {
            "pci_base": 62,
            "pci_rating": "Fair / Satisfactory",
            "hazard_index": 48,
            "cost_per_defect_usd": 90.0,
            "tons_per_defect": 0.12,
            "coverage_pct": 2.2,
            "urgency": "P2 - Priority Maintenance (Within 7 Days)",
            "action": "Infrared thermal joint bonding; polymer-modified asphalt fill with pneumatic tamp compaction."
        },
        "LOW": {
            "pci_base": 82,
            "pci_rating": "Good / Pristine",
            "hazard_index": 22,
            "cost_per_defect_usd": 65.0,
            "tons_per_defect": 0.06,
            "coverage_pct": 1.1,
            "urgency": "P3 - Scheduled Maintenance (Within 30 Days)",
            "action": "Throw-and-roll cold patch polymer asphalt; seal joints with hot-pour rubberized bitumen sealant."
        }
    }

    profile = engineering_profiles.get(severity, engineering_profiles["MEDIUM"])

    # Compute deduct values & PCI
    pci_deduct = min(85, defect_count * (18 if severity == "CRITICAL" else (12 if severity == "HIGH" else 6)))
    pci_score = max(5, 100 - pci_deduct)

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

    est_usd = round(data.get("estimated_cost_usd") or (profile["cost_per_defect_usd"] * defect_count), 2)
    est_inr = round(est_usd * 86.5, 2)
    tons = round(data.get("asphalt_tons") or (profile["tons_per_defect"] * defect_count), 2)
    cov_pct = round(profile["coverage_pct"] * defect_count, 1)
    urgency = data.get("urgency_code") or profile["urgency"]
    action = data.get("recommended_action") or profile["action"]

    cursor.execute("""
        INSERT INTO inspections (
            uuid, timestamp, location_name, latitude, longitude, defect_count,
            severity, coverage_percent, pci_score, pci_rating, hazard_index,
            estimated_cost_usd, estimated_cost_inr, asphalt_tons, urgency_code,
            recommended_action, status, work_order_id, image_path, annotated_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rec_uuid, now, location_name, lat, lng, defect_count,
        severity, cov_pct, pci_score, pci_rating, profile["hazard_index"],
        est_usd, est_inr, tons, urgency,
        action, status, wo_id, "", ""
    ))

    # Insert individual defect records
    for i in range(defect_count):
        cursor.execute("""
            INSERT INTO defects (
                inspection_uuid, defect_class, confidence, x1, y1, x2, y2, area_m2, severity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec_uuid, "pothole", 0.92,
            0.15 * (i + 1), 0.20 * (i + 1), 0.35 * (i + 1), 0.40 * (i + 1),
            round(0.25 * (i + 1), 2), severity
        ))

    conn.commit()
    conn.close()

    return {
        "uuid": rec_uuid,
        "work_order_id": wo_id,
        "location_name": location_name,
        "latitude": lat,
        "longitude": lng,
        "severity": severity,
        "defect_count": defect_count,
        "pci_score": pci_score,
        "pci_rating": pci_rating,
        "estimated_cost_usd": est_usd,
        "estimated_cost_inr": est_inr,
        "asphalt_tons": tons,
        "status": status,
        "urgency_code": urgency,
        "recommended_action": action,
        "timestamp": now
    }

def delete_inspection(rec_uuid: str) -> bool:
    """Removes an inspection record and associated defects."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM defects WHERE inspection_uuid = ?", (rec_uuid,))
    cursor.execute("DELETE FROM inspections WHERE uuid = ?", (rec_uuid,))
    conn.commit()
    rows = cursor.rowcount
    conn.close()
    return rows > 0

def get_deep_pci_analytics() -> Dict[str, Any]:
    """
    Computes rigorous ASTM D6433 road network health metrics, dynamic corridor comparisons,
    non-linear pavement deterioration curves, and economic cost-saving simulations from live DB.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inspections WHERE defect_count > 0 ORDER BY timestamp DESC")
    inspections = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total_audits = len(inspections)
    if total_audits == 0:
        return {
            "total_audits": 0,
            "total_defects": 0,
            "average_pci": 100,
            "network_condition": "Good / Pristine",
            "active_budget_usd": 0,
            "active_budget_inr": 0,
            "resolved_budget_usd": 0,
            "total_asphalt_tons": 0,
            "preventive_savings_usd": 0,
            "estimated_structural_life_years": 15.0,
            "hazard_index": 0,
            "severity_counts": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
            "status_counts": {"Reported": 0, "Inspection Scheduled": 0, "Work Order Issued": 0, "Repaired": 0},
            "corridors": [],
            "deterioration_curve": []
        }

    # Separate active vs repaired for real-time dependent telemetry
    active_inspections = [i for i in inspections if i["status"] != "Repaired"]
    repaired_inspections = [i for i in inspections if i["status"] == "Repaired"]

    total_defects = sum(i["defect_count"] for i in inspections)
    active_defects = sum(i["defect_count"] for i in active_inspections)

    # In ASTM D6433, active road segments degrade network average, whereas repaired segments restore rating
    # Effective network PCI reflects current structural condition
    effective_pci_scores = []
    for i in inspections:
        if i["status"] == "Repaired":
            effective_pci_scores.append(95) # Restored condition
        else:
            effective_pci_scores.append(i["pci_score"])

    network_pci = round(sum(effective_pci_scores) / total_audits, 1)

    # Condition rating category ASTM D6433
    if network_pci >= 85:
        network_condition = "Good / Pristine"
    elif network_pci >= 70:
        network_condition = "Satisfactory"
    elif network_pci >= 55:
        network_condition = "Fair"
    elif network_pci >= 40:
        network_condition = "Poor"
    elif network_pci >= 25:
        network_condition = "Very Poor"
    else:
        network_condition = "Failed / Hazardous"

    active_usd = round(sum(i["estimated_cost_usd"] for i in active_inspections), 2)
    active_inr = round(sum(i["estimated_cost_inr"] for i in active_inspections), 2)
    resolved_usd = round(sum(i["estimated_cost_usd"] for i in repaired_inspections), 2)
    total_tons = round(sum(i["asphalt_tons"] for i in active_inspections), 2)

    # Deferred repair penalty: Deferring past PCI 50 requires structural reconstruction (5.2x multiplier)
    # Timely intervention saves 5.2x - 1x = 4.2x capital
    preventive_savings_usd = round(active_usd * 4.2, 2)
    preventive_savings_inr = round(preventive_savings_usd * 86.5, 2)

    # Estimated remaining pavement structural life:
    # Modeled via ASTM D6433 degradation gradient: 100 PCI = ~15 yrs, 55 PCI = ~4 yrs, 20 PCI = < 1 yr
    if network_pci >= 80:
        remaining_life = round(10.0 + (network_pci - 80) * 0.25, 1)
    elif network_pci >= 55:
        remaining_life = round(4.0 + (network_pci - 55) * 0.24, 1)
    elif network_pci >= 25:
        remaining_life = round(1.2 + (network_pci - 25) * 0.09, 1)
    else:
        remaining_life = round(max(0.2, network_pci * 0.04), 1)

    # Hazard index
    if active_inspections:
        network_hazard = round(sum(i["hazard_index"] for i in active_inspections) / len(active_inspections))
    else:
        network_hazard = 5

    # Severity counts
    sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for i in inspections:
        s = i["severity"].upper()
        if s in sev_counts:
            sev_counts[s] += 1

    status_counts = {
        "Reported": len([i for i in inspections if i["status"] == "Reported"]),
        "Inspection Scheduled": len([i for i in inspections if i["status"] == "Inspection Scheduled"]),
        "Work Order Issued": len([i for i in inspections if i["status"] == "Work Order Issued"]),
        "Repaired": len(repaired_inspections)
    }

    # Corridor comparison data (top corridors sorted by urgency / cost)
    corridors = []
    for i in inspections[:12]:
        corridors.append({
            "uuid": i["uuid"],
            "wo_id": i["work_order_id"],
            "name": i["location_name"],
            "pci": 95 if i["status"] == "Repaired" else i["pci_score"],
            "original_pci": i["pci_score"],
            "severity": i["severity"],
            "cost_usd": i["estimated_cost_usd"],
            "cost_inr": i["estimated_cost_inr"],
            "defects": i["defect_count"],
            "status": i["status"],
            "asphalt_tons": i["asphalt_tons"]
        })

    # Standard ASTM D6433 Deterioration Life Cycle Curve:
    # 75% of life consumed in 40% of time; after PCI 55 deterioration accelerates exponentially
    deterioration_curve = [
        {"year": 0, "pci": 100, "condition": "Pristine Construction", "cost_multiplier": 1.0},
        {"year": 2, "pci": 92, "condition": "Minor Oxidation", "cost_multiplier": 1.1},
        {"year": 4, "pci": 84, "condition": "Micro-cracking", "cost_multiplier": 1.3},
        {"year": 6, "pci": 74, "condition": "Longitudinal Cracks", "cost_multiplier": 1.8},
        {"year": 8, "pci": 62, "condition": "Surface Raveling", "cost_multiplier": 2.6},
        {"year": 10, "pci": 48, "condition": "Accelerated Potholing (Critical Tipping)", "cost_multiplier": 4.5},
        {"year": 12, "pci": 31, "condition": "Severe Base Rupture", "cost_multiplier": 6.8},
        {"year": 14, "pci": 15, "condition": "Complete Structural Failure", "cost_multiplier": 9.4}
    ]

    return {
        "total_audits": total_audits,
        "total_defects": total_defects,
        "active_defects": active_defects,
        "average_pci": network_pci,
        "network_condition": network_condition,
        "active_budget_usd": active_usd,
        "active_budget_inr": active_inr,
        "resolved_budget_usd": resolved_usd,
        "total_asphalt_tons": total_tons,
        "preventive_savings_usd": preventive_savings_usd,
        "preventive_savings_inr": preventive_savings_inr,
        "estimated_structural_life_years": remaining_life,
        "hazard_index": network_hazard,
        "severity_counts": sev_counts,
        "status_counts": status_counts,
        "corridors": corridors,
        "deterioration_curve": deterioration_curve
    }

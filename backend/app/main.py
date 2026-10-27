"""
RoadVision AI - Next-Gen Road Defect & Pothole Intelligence Backend
FastAPI Main Application
"""
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from PIL import Image

from .config import (
    BASE_DIR, FRONTEND_DIR, SAMPLES_DIR, EXPORTS_DIR, UPLOADS_DIR,
    PRIMARY_MODEL_PATH
)
from .detector import RoadDefectDetector
from .database import (
    init_db, save_inspection, get_all_inspections,
    get_inspection_by_uuid, update_inspection_status,
    add_citizen_report, get_all_citizen_reports,
    create_manual_work_order, delete_inspection, get_deep_pci_analytics
)
from .report_generator import generate_pdf_report, generate_csv_report
from .models import CitizenReportRequest, StatusUpdateRequest, WorkOrderCreateRequest, GisDefectLogRequest


# Initialize FastAPI app
app = FastAPI(
    title="RoadVision AI",
    description="Next-Generation Pothole & Road Defect Detection Platform",
    version="2.0.0"
)

# Enable CORS for external access / frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector and database on startup
detector = RoadDefectDetector()

@app.on_event("startup")
def startup_event():
    init_db()
    print("[RoadVision AI] Backend initialized and ready for road defect inference.")


# =========================================================================
# System Health & Model Telemetry
# =========================================================================

@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "service": "RoadVision AI Intelligence Server",
        "version": "2.0.0",
        "model_loaded": True,
        "model_path": detector.model_path,
        "device": "CPU"
    }

@app.get("/api/model-info")
def get_model_info():
    """Returns deep neural network metadata, evaluation metrics and benchmarks."""
    return {
        "architecture": "YOLOv8n (Ultralytics Nano Backbone)",
        "framework": "PyTorch / TorchVision",
        "classes": ["pothole"],
        "input_resolution": "416x416 px",
        "device": "CPU / CUDA Auto-Adaptive",
        "metrics": {
            "mAP_50": 72.1,
            "mAP_50_95": 43.7,
            "precision": 76.2,
            "recall": 63.3,
            "validation_images": 133,
            "pothole_instances_tested": 330,
            "average_inference_time_ms": 152
        },
        "standards_compliance": "ASTM D6433 Pavement Distress Severity Standard",
        "weights_file": str(PRIMARY_MODEL_PATH.name) if PRIMARY_MODEL_PATH.exists() else "yolov8n.pt"
    }


# =========================================================================
# Preset Sample Road Gallery
# =========================================================================

@app.get("/api/samples")
def list_sample_images():
    """Returns pre-loaded sample road images for instant testing without file upload."""
    samples = []
    if SAMPLES_DIR.exists():
        for img_file in SAMPLES_DIR.glob("*.jpg"):
            samples.append({
                "id": img_file.name,
                "name": img_file.stem.replace("_jpg.rf.", " - Preset "),
                "filename": img_file.name,
                "url": f"/api/samples/{img_file.name}"
            })
    return {"samples": samples[:8]}

@app.get("/api/samples/{filename}")
def get_sample_image(filename: str):
    file_path = SAMPLES_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample image not found")
    return FileResponse(str(file_path), media_type="image/jpeg")


# =========================================================================
# Core Defect Detection (Image & Video)
# =========================================================================

@app.post("/api/detect/image")
async def detect_road_image(
    file: Optional[UploadFile] = File(None),
    sample_id: Optional[str] = Form(None),
    confidence: float = Form(0.25),
    location_name: Optional[str] = Form("Roadway Survey Corridor"),
    latitude: Optional[float] = Form(40.7128),
    longitude: Optional[float] = Form(-74.0060),
):
    """
    Primary image detection endpoint.
    Accepts uploaded image file OR sample_id.
    Returns full detection telemetry, ASTM severity, crops, and base64 imagery.
    """
    temp_path = None
    try:
        if file and file.filename:
            file_ext = Path(file.filename).suffix or ".jpg"
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            temp_path = UPLOADS_DIR / unique_filename
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            input_source = temp_path
        elif sample_id:
            sample_path = SAMPLES_DIR / sample_id
            if not sample_path.exists():
                raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found.")
            input_source = sample_path
        else:
            raise HTTPException(status_code=400, detail="Must provide an image file or sample_id.")

        # Run inference
        result = detector.detect_image(
            input_source,
            conf_threshold=confidence,
            img_size=416
        )

        # Only generate a municipal work order if actual defects were detected
        if result["metrics"].get("defect_count", 0) > 0:
            db_data = {
                "location_name": location_name or "Survey Road Corridor",
                "latitude": latitude or 40.7128,
                "longitude": longitude or -74.0060,
                "metrics": result["metrics"],
                "detections": result["detections"],
                "image_path": str(input_source)
            }
            rec_uuid = save_inspection(db_data)
            result["inspection_uuid"] = rec_uuid
            result["work_order_id"] = f"WO-{rec_uuid[:6].upper()}"
        else:
            result["inspection_uuid"] = None
            result["work_order_id"] = None

        return result

    finally:
        pass

@app.post("/api/detect/video")
async def detect_road_video(
    file: UploadFile = File(...),
    confidence: float = Form(0.25)
):
    """
    Dashcam video survey endpoint.
    Processes video frames, deduplicates potholes across frames, and generates a hazard timeline.
    """
    file_ext = Path(file.filename).suffix or ".mp4"
    temp_video_path = UPLOADS_DIR / f"vid_{uuid.uuid4()}{file_ext}"
    try:
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = detector.detect_video_trip(
            str(temp_video_path),
            conf_threshold=confidence,
            frame_interval=6,
            max_duration_sec=30
        )
        return result
    finally:
        if temp_video_path.exists():
            try:
                temp_video_path.unlink()
            except Exception:
                pass


# =========================================================================
# Municipal Work Orders, Inspections & Kanban
# =========================================================================

@app.get("/api/inspections")
def list_inspections(status: Optional[str] = None, severity: Optional[str] = None):
    inspections = get_all_inspections()
    if status:
        inspections = [i for i in inspections if i["status"].lower() == status.lower()]
    if severity:
        inspections = [i for i in inspections if i["severity"].lower() == severity.lower()]
    return {"inspections": inspections}

@app.post("/api/municipal/work-orders")
def create_work_order(req: WorkOrderCreateRequest):
    """Creates a new municipal work order directly into the SQLite database."""
    created = create_manual_work_order(req.model_dump())
    return {"success": True, "work_order": created}

@app.get("/api/inspections/{rec_uuid}")
def get_inspection_details(rec_uuid: str):
    data = get_inspection_by_uuid(rec_uuid)
    if not data:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    return data

@app.post("/api/inspections/{rec_uuid}/update-status")
def update_status(rec_uuid: str, req: StatusUpdateRequest):
    success = update_inspection_status(rec_uuid, req.status)
    if not success:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    return {"success": True, "uuid": rec_uuid, "new_status": req.status}

@app.delete("/api/inspections/{rec_uuid}")
def remove_inspection(rec_uuid: str):
    success = delete_inspection(rec_uuid)
    if not success:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    return {"success": True, "message": "Work order deleted successfully"}

@app.get("/api/inspections/{rec_uuid}/pdf")
def download_pdf_report(rec_uuid: str):
    data = get_inspection_by_uuid(rec_uuid)
    if not data:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    
    pdf_filename = f"RoadAudit_{data.get('work_order_id', rec_uuid[:8])}.pdf"
    pdf_path = EXPORTS_DIR / pdf_filename
    generate_pdf_report(data, pdf_path)

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=pdf_filename
    )

@app.get("/api/inspections/{rec_uuid}/csv")
def download_csv_report(rec_uuid: str):
    data = get_inspection_by_uuid(rec_uuid)
    if not data:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    
    csv_content = generate_csv_report(data)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=RoadAudit_{rec_uuid[:8]}.csv"}
    )


# =========================================================================
# GIS Map & Analytics
# =========================================================================

@app.get("/api/gis/defects")
def get_gis_geojson():
    """Generates GeoJSON FeatureCollection for interactive Leaflet defect mapping."""
    inspections = get_all_inspections()
    features = []

    for ins in inspections:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [ins["longitude"], ins["latitude"]]
            },
            "properties": {
                "uuid": ins["uuid"],
                "work_order_id": ins["work_order_id"],
                "location_name": ins["location_name"],
                "severity": ins["severity"],
                "pci_score": ins["pci_score"],
                "pci_rating": ins["pci_rating"],
                "defect_count": ins["defect_count"],
                "coverage_percent": ins["coverage_percent"],
                "hazard_index": ins["hazard_index"],
                "status": ins["status"],
                "estimated_cost_usd": ins["estimated_cost_usd"],
                "estimated_cost_inr": ins["estimated_cost_inr"],
                "asphalt_tons": ins["asphalt_tons"],
                "urgency_code": ins["urgency_code"],
                "recommended_action": ins["recommended_action"],
                "timestamp": ins["timestamp"]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }

@app.post("/api/gis/log-defect")
def log_defect_from_map(req: GisDefectLogRequest):
    """Enables users to click anywhere on the GIS road map and log a realistic defect."""
    created = create_manual_work_order({
        "location_name": req.location_name,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "severity": req.severity,
        "defect_count": req.defect_count,
        "status": "Reported"
    })
    return {"success": True, "defect": created}

@app.get("/api/analytics/pci-stats")
def get_analytics_stats():
    """
    Returns empirical ASTM D6433 road network health analytics,
    dynamically dependent on real database records and repair lifecycles.
    """
    deep_stats = get_deep_pci_analytics()
    # Populate backward-compatible keys for existing widgets
    deep_stats["severity_breakdown"] = deep_stats.get("severity_counts", {})
    deep_stats["status_breakdown"] = deep_stats.get("status_counts", {})
    deep_stats["total_budget_usd"] = deep_stats.get("active_budget_usd", 0)
    deep_stats["total_budget_inr"] = deep_stats.get("active_budget_inr", 0)
    return deep_stats


# =========================================================================
# Citizen Reporting Portal
# =========================================================================

@app.post("/api/citizen/report")
def submit_citizen_report(req: CitizenReportRequest):
    ticket_id = add_citizen_report(req.model_dump())
    return {
        "success": True,
        "ticket_id": ticket_id,
        "message": f"Your civic road defect report #{ticket_id} has been dispatched to road maintenance."
    }

@app.get("/api/citizen/reports")
def list_citizen_reports():
    return {"reports": get_all_citizen_reports()}


# =========================================================================
# Frontend Static Mount
# =========================================================================

# Mount frontend directory
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Mount public directory (for Lottie files, raw assets, etc.)
PUBLIC_DIR = BASE_DIR / "public"
if PUBLIC_DIR.exists():
    app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

@app.get("/")
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return HTMLResponse("<h1>RoadVision AI Backend Running. Frontend index.html not yet built.</h1>")

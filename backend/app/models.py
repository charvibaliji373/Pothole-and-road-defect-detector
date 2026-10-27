"""
Pydantic Models for RoadVision AI API
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class DefectItem(BaseModel):
    id: Optional[int] = None
    class_name: str = "pothole"
    confidence: float
    bbox: List[float]
    area_px: Optional[float] = None
    estimated_area_m2: Optional[float] = None
    severity: Optional[str] = "MEDIUM"

class MetricsData(BaseModel):
    defect_count: int
    coverage_percent: float
    severity: str
    pci_score: int
    pci_rating: str
    hazard_index: int
    speed_advisory_mph: int
    estimated_surface_area_m2: float
    estimated_volume_m3: float
    estimated_asphalt_tons: float
    estimated_cost_usd: float
    estimated_cost_inr: float
    recommended_action: str
    urgency_code: str

class DetectionResponse(BaseModel):
    success: bool
    inference_time_ms: float
    image_dimensions: Dict[str, int]
    metrics: MetricsData
    detections: List[Dict[str, Any]]
    crops: List[Dict[str, Any]]
    original_image_base64: str
    annotated_image_base64: str

class CitizenReportRequest(BaseModel):
    citizen_name: str
    phone: Optional[str] = ""
    description: str
    landmark: str
    latitude: float
    longitude: float
    reported_severity: str = "MEDIUM"

class StatusUpdateRequest(BaseModel):
    status: str

class WorkOrderCreateRequest(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    severity: str = "HIGH"
    defect_count: int = 1
    estimated_cost_usd: Optional[float] = None
    asphalt_tons: Optional[float] = None
    recommended_action: Optional[str] = None
    urgency_code: Optional[str] = None
    status: str = "Reported"

class GisDefectLogRequest(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    severity: str = "MEDIUM"
    defect_count: int = 1
    description: Optional[str] = "Pothole hazard identified via GIS coordinate survey."

"""
Configuration and constants for RoadVision AI
"""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
MODELS_DIR = BACKEND_DIR / "models"
SAMPLES_DIR = BACKEND_DIR / "samples"
DATA_DIR = BACKEND_DIR / "data"
EXPORTS_DIR = DATA_DIR / "exports"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "roadvision.db"

# Create required directories
for directory in [DATA_DIR, EXPORTS_DIR, UPLOADS_DIR, SAMPLES_DIR, MODELS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Model configuration
PRIMARY_MODEL_PATH = MODELS_DIR / "best.pt"
FALLBACK_MODEL_PATH = MODELS_DIR / "yolov8n.pt"

# ASTM D6433 & Civil Engineering road repair parameters
ASPHALT_DENSITY_KG_PER_M3 = 2400.0  # standard compacted hot mix asphalt density
AVERAGE_POTHOLE_DEPTH_M = 0.065     # average 65mm / 2.5 inches depth for severity scaling
COST_PER_TON_ASPHALT_USD = 135.0    # includes materials, labor & machinery allocation ($)
USD_TO_INR_RATE = 86.5              # exchange rate for dual currency reporting

# Severity thresholds based on total defect area percentage of visual frame
SEVERITY_THRESHOLDS = {
    "NONE": (0.0, 0.0),
    "LOW": (0.001, 3.0),
    "MEDIUM": (3.0, 10.0),
    "HIGH": (10.0, 20.0),
    "CRITICAL": (20.0, 100.0)
}

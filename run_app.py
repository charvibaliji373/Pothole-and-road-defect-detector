"""
RoadVision AI - Unified Application Launcher
Starts the FastAPI backend and serves the interactive glassmorphic frontend on http://127.0.0.1:8000
"""
import sys
import uvicorn
from pathlib import Path

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if __name__ == "__main__":
    print("=" * 70)
    print(">> RoadVision AI - Autonomous Road Defect & Pothole Intelligence")
    print("=" * 70)
    print("Server starting at: http://127.0.0.1:8000")
    print("Interactive Swagger Docs at: http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to stop the server.")
    print("=" * 70)

    uvicorn.run(
        "backend.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info"
    )

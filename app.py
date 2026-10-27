"""
RoadVision AI - Hugging Face Spaces & Production Cloud Entrypoint
Compatible with Hugging Face Spaces (Gradio SDK - 100% Free, 16GB RAM)
Serves the complete Glassmorphic Frontend at / and Gradio Mount at /gradio
"""
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import uvicorn
from backend.app.main import app

# Optional Gradio wrapper for Hugging Face Spaces compatibility
try:
    import gradio as gr
    
    with gr.Blocks(title="RoadVision AI") as demo:
        gr.Markdown("# 🛣️ RoadVision AI — Autonomous Road Defect Intelligence")
        gr.Markdown(
            "Access the full interactive glassmorphic web dashboard with Mapbox Vector HD, "
            "Municipal Kanban, and Live YOLOv8 Inference: [👉 Open Full Web App](/) (or navigate to `/` in your browser)."
        )
    
    # Mount Gradio at /gradio so root / serves our custom interactive frontend
    app = gr.mount_gradio_app(app, demo, path="/gradio")
except ImportError:
    pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    host = os.getenv("HOST", "0.0.0.0")
    print("=" * 70)
    print(f">> RoadVision AI running on http://{host}:{port}")
    print("=" * 70)
    uvicorn.run(app, host=host, port=port)

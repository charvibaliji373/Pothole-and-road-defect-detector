"""
RoadVision AI - Pothole & Road Defect Training Pipeline
Fine-tunes YOLOv8 on custom road damage datasets (Roboflow / Pascal VOC / YOLO format).
"""
import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

def train_model(data_yaml_path: str, epochs: int = 30, imgsz: int = 416, batch: int = 4, device: str = None):
    data_path = Path(data_yaml_path).resolve()
    if not data_path.is_file():
        raise FileNotFoundError(f"Dataset config YAML not found: {data_path}")

    # Auto-detect GPU/CPU
    if device is None:
        device = "0" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print(">> Starting RoadVision AI YOLOv8 Training")
    print(f">> Dataset Config: {data_path}")
    print(f">> Epochs: {epochs} | Image Size: {imgsz} | Batch Size: {batch}")
    print(f">> Device: {device} ({'GPU Acceleration Enabled' if device != 'cpu' else 'CPU Mode'})")
    print("=" * 60)

    # Initialize base YOLOv8 nano model
    model = YOLO("yolov8n.pt")

    results = model.train(
        data=str(data_path),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=10,
        device=device,
        project="runs/detect/pothole",
        name="roadvision_custom_run",
        plots=True,
        save=True,
        exist_ok=True
    )

    print("\n>> Training successfully finished!")
    print(f">> Optimal model weights saved to: {results.save_dir}/weights/best.pt")
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLOv8 on Road Defect Dataset")
    parser.add_argument("--data", type=str, default="data.yaml", help="Path to data.yaml dataset definition")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=416, help="Input resolution (320, 416, 640)")
    parser.add_argument("--batch", type=int, default=4, help="Batch size")
    parser.add_argument("--device", type=str, default=None, help="Device to use ('cpu' or '0')")

    args = parser.parse_args()
    try:
        train_model(args.data, args.epochs, args.imgsz, args.batch, args.device)
    except Exception as e:
        print(f"Error during training initialization: {e}")

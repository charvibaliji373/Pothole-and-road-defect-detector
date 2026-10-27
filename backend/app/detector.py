"""
YOLOv8 Road Defect & Pothole Detection Engine
Features high-contrast visual HUD annotations, defect cropping, and video tracking.
"""
import io
import base64
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2
from ultralytics import YOLO

from .config import PRIMARY_MODEL_PATH, FALLBACK_MODEL_PATH
from .severity import calculate_defect_metrics


class RoadDefectDetector:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RoadDefectDetector, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.model = None
        self.model_path = str(PRIMARY_MODEL_PATH) if PRIMARY_MODEL_PATH.exists() else str(FALLBACK_MODEL_PATH)
        self._initialized = True

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def get_model(self):
        if self.model is None:
            self.load_model()
        return self.model

    def load_model(self):
        """Loads the trained pothole model on-demand or falls back to YOLOv8n."""
        if self.model is not None:
            return
        import torch
        # Cap CPU threads to prevent memory spiking on constrained cloud tiers like Render
        try:
            torch.set_num_threads(2)
        except Exception:
            pass

        if PRIMARY_MODEL_PATH.exists():
            print(f"[Detector] Lazy-loading primary trained model: {PRIMARY_MODEL_PATH}")
            self.model = YOLO(str(PRIMARY_MODEL_PATH))
            self.model_path = str(PRIMARY_MODEL_PATH)
        elif FALLBACK_MODEL_PATH.exists():
            print(f"[Detector] Loading fallback model: {FALLBACK_MODEL_PATH}")
            self.model = YOLO(str(FALLBACK_MODEL_PATH))
            self.model_path = str(FALLBACK_MODEL_PATH)
        else:
            print("[Detector] Warning: Neither custom weights nor local YOLOv8n found. Initializing yolov8n.")
            self.model = YOLO("yolov8n.pt")
            self.model_path = "yolov8n.pt"

    def detect_image(
        self,
        image_input,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        img_size: int = 416
    ) -> Dict[str, Any]:
        """
        Runs pothole & defect detection on a PIL Image, filepath, or numpy array.
        Returns metrics, bounding box coordinates, crops, and annotated image.
        """
        start_time = time.time()

        if isinstance(image_input, (str, Path)):
            pil_img = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB))
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.convert("RGB")
        else:
            raise ValueError("Unsupported image input type")

        img_w, img_h = pil_img.size

        # Perform YOLO inference (lazy loaded)
        results = self.get_model().predict(
            source=pil_img,
            conf=conf_threshold,
            iou=iou_threshold,
            imgsz=img_size,
            device="cpu",
            verbose=False
        )[0]

        raw_boxes = []
        detections = []

        if results.boxes is not None and len(results.boxes) > 0:
            coords = results.boxes.xyxy.cpu().numpy()
            confs = results.boxes.conf.cpu().numpy()
            clss = results.boxes.cls.cpu().numpy()

            for i in range(len(coords)):
                x1, y1, x2, y2 = coords[i].tolist()
                conf = float(confs[i])
                cls_id = int(clss[i])
                class_name = results.names.get(cls_id, "pothole")

                # Clamp to image boundaries
                x1 = max(0.0, min(float(img_w), x1))
                y1 = max(0.0, min(float(img_h), y1))
                x2 = max(0.0, min(float(img_w), x2))
                y2 = max(0.0, min(float(img_h), y2))

                raw_boxes.append([x1, y1, x2, y2])
                detections.append({
                    "class_name": class_name,
                    "confidence": round(conf * 100.0, 1),
                    "confidence_ratio": round(conf, 4),
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                })

        # Calculate ASTM D6433 engineering metrics
        metrics = calculate_defect_metrics(raw_boxes, img_w, img_h)

        # Merge detection details with box metrics
        for idx, det in enumerate(detections):
            if idx < len(metrics["boxes_detail"]):
                det.update(metrics["boxes_detail"][idx])

        # Generate futuristic HUD annotated image
        annotated_pil, crops_base64 = self._render_hud_annotations(pil_img, detections, metrics["severity"])

        # Convert original & annotated images to base64 for instant frontend rendering
        orig_b64 = self._pil_to_base64(pil_img)
        annotated_b64 = self._pil_to_base64(annotated_pil)

        inference_time_ms = round((time.time() - start_time) * 1000.0, 1)

        return {
            "success": True,
            "inference_time_ms": inference_time_ms,
            "image_dimensions": {"width": img_w, "height": img_h},
            "metrics": metrics,
            "detections": detections,
            "crops": crops_base64,
            "original_image_base64": f"data:image/jpeg;base64,{orig_b64}",
            "annotated_image_base64": f"data:image/png;base64,{annotated_b64}",
        }

    def _render_hud_annotations(
        self,
        pil_img: Image.Image,
        detections: List[Dict[str, Any]],
        overall_severity: str
    ) -> Tuple[Image.Image, List[Dict[str, Any]]]:
        """
        Renders sleek glass-style HUD bounding boxes with glowing neon accents,
        bracketed corners, and high-visibility telemetry tags.
        """
        img_w, img_h = pil_img.size
        # Work on a copy in RGBA for translucent glow overlays
        annotated = pil_img.copy().convert("RGBA")
        overlay = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
        draw_overlay = ImageDraw.Draw(overlay)
        draw_main = ImageDraw.Draw(annotated)

        # Color schemes by defect severity
        color_map = {
            "LOW": {"stroke": (234, 179, 8, 255), "fill": (234, 179, 8, 45), "hex": "#eab308"},
            "MEDIUM": {"stroke": (249, 115, 22, 255), "fill": (249, 115, 22, 55), "hex": "#f97316"},
            "HIGH": {"stroke": (239, 68, 68, 255), "fill": (239, 68, 68, 70), "hex": "#ef4444"},
            "CRITICAL": {"stroke": (255, 0, 85, 255), "fill": (255, 0, 85, 85), "hex": "#ff0055"},
            "NONE": {"stroke": (16, 185, 129, 255), "fill": (16, 185, 129, 40), "hex": "#10b981"}
        }

        crops_base64 = []

        for idx, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]
            sev = det.get("severity", "MEDIUM")
            colors = color_map.get(sev, color_map["MEDIUM"])
            stroke_col = colors["stroke"]
            fill_col = colors["fill"]

            # 1. Translucent bounding fill
            draw_overlay.rectangle([x1, y1, x2, y2], fill=fill_col, outline=stroke_col, width=2)

            # 2. Futuristic corner brackets
            corner_len = min(22.0, max(8.0, (x2 - x1) * 0.25), max(8.0, (y2 - y1) * 0.25))
            c_width = 3
            # Top-left
            draw_overlay.line([(x1, y1), (x1 + corner_len, y1)], fill=(255, 255, 255, 240), width=c_width)
            draw_overlay.line([(x1, y1), (x1, y1 + corner_len)], fill=(255, 255, 255, 240), width=c_width)
            # Top-right
            draw_overlay.line([(x2, y1), (x2 - corner_len, y1)], fill=(255, 255, 255, 240), width=c_width)
            draw_overlay.line([(x2, y1), (x2, y1 + corner_len)], fill=(255, 255, 255, 240), width=c_width)
            # Bottom-left
            draw_overlay.line([(x1, y2), (x1 + corner_len, y2)], fill=(255, 255, 255, 240), width=c_width)
            draw_overlay.line([(x1, y2), (x1, y2 - corner_len)], fill=(255, 255, 255, 240), width=c_width)
            # Bottom-right
            draw_overlay.line([(x2, y2), (x2 - corner_len, y2)], fill=(255, 255, 255, 240), width=c_width)
            draw_overlay.line([(x2, y2), (x2, y2 - corner_len)], fill=(255, 255, 255, 240), width=c_width)

            # 3. Label badge
            conf = det.get("confidence", 0.0)
            label_text = f"#{det.get('id', idx+1)} POTHOLE  {conf:.0f}% [{sev}]"
            tag_h = 20
            tag_w = len(label_text) * 8 + 14
            tag_y1 = max(0.0, y1 - tag_h - 4)
            tag_y2 = tag_y1 + tag_h

            # Tag background
            draw_overlay.rounded_rectangle(
                [x1, tag_y1, x1 + tag_w, tag_y2],
                radius=4,
                fill=(15, 23, 42, 220),
                outline=stroke_col,
                width=1
            )
            draw_overlay.text((x1 + 6, tag_y1 + 3), label_text, fill=(255, 255, 255, 255))

            # 4. Extract individual defect crop for deep audit
            crop_margin = 10
            cx1 = max(0, int(x1 - crop_margin))
            cy1 = max(0, int(y1 - crop_margin))
            cx2 = min(img_w, int(x2 + crop_margin))
            cy2 = min(img_h, int(y2 + crop_margin))
            if cx2 > cx1 and cy2 > cy1:
                crop_pil = pil_img.crop((cx1, cy1, cx2, cy2))
                crop_b64 = self._pil_to_base64(crop_pil, format="JPEG", quality=85)
                crops_base64.append({
                    "id": det.get("id", idx + 1),
                    "crop_base64": f"data:image/jpeg;base64,{crop_b64}",
                    "severity": sev,
                    "confidence": conf,
                    "area_m2": det.get("estimated_area_m2", 0.0)
                })

        # Composite the overlay onto annotated image
        annotated = Image.alpha_composite(annotated, overlay)

        # Convert back to RGB for export
        return annotated.convert("RGB"), crops_base64

    def detect_video_trip(
        self,
        video_path: str,
        conf_threshold: float = 0.25,
        frame_interval: int = 5,
        max_duration_sec: int = 45
    ) -> Dict[str, Any]:
        """
        Analyzes dashcam or road survey video footage.
        Extracts defect frames, tracks pothole instances along the route,
        and generates an interactive defect timeline.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video file at {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_sec = total_frames / fps

        frame_count = 0
        analyzed_frames = 0
        tracked_potholes = 0
        timeline_events = []
        keyframe_snapshots = []
        max_severity = "NONE"

        severity_rank = {"NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        highest_rank = 0

        # Simple centroid-based deduplication tracker for consecutive frames
        active_tracks = [] # [{last_bbox, last_frame, track_id}]
        next_track_id = 1

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or (frame_count / fps) > max_duration_sec:
                break

            if frame_count % frame_interval == 0:
                analyzed_frames += 1
                timestamp_sec = round(frame_count / fps, 2)
                timestamp_str = f"{int(timestamp_sec // 60):02d}:{int(timestamp_sec % 60):02d}"

                # Run inference on frame
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_frame = Image.fromarray(rgb_frame)
                img_w, img_h = pil_frame.size

                results = self.get_model().predict(
                    source=pil_frame,
                    conf=conf_threshold,
                    imgsz=320,
                    device="cpu",
                    verbose=False
                )[0]

                frame_boxes = []
                if results.boxes is not None and len(results.boxes) > 0:
                    coords = results.boxes.xyxy.cpu().numpy()
                    confs = results.boxes.conf.cpu().numpy()

                    for i in range(len(coords)):
                        x1, y1, x2, y2 = coords[i].tolist()
                        frame_boxes.append([x1, y1, x2, y2])

                if frame_boxes:
                    metrics = calculate_defect_metrics(frame_boxes, img_w, img_h)
                    sev = metrics["severity"]
                    if severity_rank[sev] > highest_rank:
                        highest_rank = severity_rank[sev]
                        max_severity = sev

                    # Track across frames to avoid double counting
                    new_tracks = 0
                    for box in frame_boxes:
                        cx = (box[0] + box[2]) / 2.0
                        cy = (box[1] + box[3]) / 2.0
                        matched = False
                        for tr in active_tracks:
                            if abs(frame_count - tr["last_frame"]) <= (frame_interval * 2):
                                t_cx = (tr["bbox"][0] + tr["bbox"][2]) / 2.0
                                t_cy = (tr["bbox"][1] + tr["bbox"][3]) / 2.0
                                dist = np.sqrt((cx - t_cx)**2 + (cy - t_cy)**2)
                                if dist < (img_w * 0.18):
                                    tr["last_frame"] = frame_count
                                    tr["bbox"] = box
                                    matched = True
                                    break
                        if not matched:
                            active_tracks.append({
                                "track_id": next_track_id,
                                "last_frame": frame_count,
                                "bbox": box
                            })
                            next_track_id += 1
                            new_tracks += 1

                    timeline_events.append({
                        "timestamp_sec": timestamp_sec,
                        "timestamp_str": timestamp_str,
                        "defect_count": len(frame_boxes),
                        "severity": sev,
                        "coverage_pct": metrics["coverage_percent"],
                        "hazard_index": metrics["hazard_index"]
                    })

                    # Save top 4 distinct keyframe snapshots
                    if len(keyframe_snapshots) < 4 and new_tracks > 0:
                        annotated_frame, _ = self._render_hud_annotations(
                            pil_frame,
                            [{"bbox": b, "severity": sev, "confidence": 85.0} for b in frame_boxes],
                            sev
                        )
                        b64 = self._pil_to_base64(annotated_frame, format="JPEG", quality=80)
                        keyframe_snapshots.append({
                            "timestamp": timestamp_str,
                            "severity": sev,
                            "defect_count": len(frame_boxes),
                            "image_base64": f"data:image/jpeg;base64,{b64}"
                        })

            frame_count += 1

        cap.release()

        tracked_potholes = max(len(active_tracks), 1 if timeline_events else 0)

        return {
            "success": True,
            "duration_seconds": round(duration_sec, 1),
            "analyzed_frames": analyzed_frames,
            "unique_defects_identified": tracked_potholes,
            "overall_severity": max_severity,
            "timeline_events": timeline_events,
            "keyframe_snapshots": keyframe_snapshots
        }

    @staticmethod
    def _pil_to_base64(img: Image.Image, format: str = "PNG", quality: int = 90) -> str:
        """Helper to convert PIL Image to Base64 ASCII string."""
        buf = io.BytesIO()
        if format.upper() == "JPEG":
            img.save(buf, format="JPEG", quality=quality)
        else:
            img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")

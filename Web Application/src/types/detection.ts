/** Single detection from the Sentinel /detect endpoints. */
export interface Detection {
  /** YOLO class name (e.g. "Pistol", "Knife") */
  class?: string;
  label?: string;
  confidence: number;
  /** [x1, y1, x2, y2] in pixel coords of the source frame */
  bbox?: [number, number, number, number];
}

/** Response shape from /detect/image and /detect/frame */
export interface DetectResponse {
  /** Annotated JPEG, base64-encoded (no data: prefix) */
  image_b64: string;
  detections: Detection[];
  counts: Record<string, number>;
  total: number;
  inference_ms: number;
  weapon_alert: boolean;
}

/** Response shape from /detect/video */
export interface DetectVideoResponse {
  frames?: Array<{
    frame_index?: number;
    timestamp?: number;
    detections: Detection[];
    image_b64?: string;
  }>;
  counts: Record<string, number>;
  total: number;
  weapon_alert: boolean;
  inference_ms?: number;
}

export interface DetectionEvent {
  id: string;
  timestamp: number;
  source: "image" | "video" | "live";
  /** Top class label */
  topLabel: string;
  /** Highest confidence in the event */
  topConfidence: number;
  /** Total detections counted */
  total: number;
  /** Per-class counts */
  counts: Record<string, number>;
  /** Annotated snapshot (data URL) */
  snapshot: string;
}

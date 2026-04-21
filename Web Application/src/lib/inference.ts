import type { Detection, DetectResponse } from "@/types/detection";

/** Capture a frame from a video/image/canvas as a JPEG Blob, downscaled. */
export async function captureFrameBlob(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  maxDim = 640,
  quality = 0.7
): Promise<{ blob: Blob; width: number; height: number }> {
  const sw =
    "videoWidth" in source
      ? source.videoWidth
      : "naturalWidth" in source
      ? source.naturalWidth
      : source.width;
  const sh =
    "videoHeight" in source
      ? source.videoHeight
      : "naturalHeight" in source
      ? source.naturalHeight
      : source.height;
  if (!sw || !sh) throw new Error("Source has no dimensions");
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      "image/jpeg",
      quality
    )
  );
  return { blob, width: w, height: h };
}

/** Wrap server's bare base64 JPEG in a data URL. */
export function toDataUrl(image_b64: string): string {
  if (!image_b64) return "";
  return image_b64.startsWith("data:") ? image_b64 : `data:image/jpeg;base64,${image_b64}`;
}

export function detectionLabel(d: Detection): string {
  return (d.class || d.label || "object").toString();
}

/** Pick the dominant label/confidence from a response. */
export function summarizeDetections(r: Pick<DetectResponse, "detections" | "counts">): {
  topLabel: string;
  topConfidence: number;
} {
  let top: Detection | undefined;
  for (const d of r.detections || []) {
    if (!top || d.confidence > top.confidence) top = d;
  }
  if (top) return { topLabel: detectionLabel(top).toUpperCase(), topConfidence: top.confidence };
  // Fall back to counts
  const entries = Object.entries(r.counts || {});
  if (entries.length) {
    const [label, count] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    return { topLabel: label.toUpperCase(), topConfidence: 0 };
  }
  return { topLabel: "THREAT", topConfidence: 0 };
}

/** Should we treat this response as a threat (above threshold)? */
export function hasThreat(r: DetectResponse, threshold: number): boolean {
  if (r.weapon_alert && (r.detections?.length || 0) === 0 && r.total === 0) return false;
  if (r.detections?.some((d) => d.confidence >= threshold)) return true;
  // Some servers may not return per-detection confidence — fall back to weapon_alert + total
  return r.weapon_alert && r.total > 0;
}

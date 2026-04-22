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

/** Keywords that indicate an actual weapon class. */
const WEAPON_KEYWORDS = [
  "pistol", "gun", "handgun", "revolver", "firearm", "rifle", "shotgun",
  "weapon", "knife", "blade", "dagger", "machete", "sword", "grenade",
];

export function isWeaponLabel(label: string): boolean {
  const l = label.toLowerCase();
  return WEAPON_KEYWORDS.some((k) => l.includes(k));
}

/** Filter detections to actual weapons above the confidence threshold. */
export function weaponDetections(r: DetectResponse, threshold: number): Detection[] {
  return (r.detections || []).filter(
    (d) => d.confidence >= threshold && isWeaponLabel(detectionLabel(d))
  );
}

/** Pick the dominant weapon label/confidence from a response. */
export function summarizeDetections(
  r: Pick<DetectResponse, "detections" | "counts">,
  threshold = 0
): { topLabel: string; topConfidence: number } {
  let top: Detection | undefined;
  for (const d of r.detections || []) {
    if (d.confidence < threshold) continue;
    if (!isWeaponLabel(detectionLabel(d))) continue;
    if (!top || d.confidence > top.confidence) top = d;
  }
  if (top) return { topLabel: detectionLabel(top).toUpperCase(), topConfidence: top.confidence };
  // Fall back to weapon counts
  const entries = Object.entries(r.counts || {}).filter(([k]) => isWeaponLabel(k));
  if (entries.length) {
    const [label] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    return { topLabel: label.toUpperCase(), topConfidence: 0 };
  }
  return { topLabel: "WEAPON", topConfidence: 0 };
}

/** Should we treat this response as a real weapon threat (above threshold)? */
export function hasThreat(r: DetectResponse, threshold: number): boolean {
  return weaponDetections(r, threshold).length > 0;
}

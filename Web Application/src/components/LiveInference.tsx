import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApi } from "./ConnectionPanel";
import { useSettings } from "@/store/settings";
import { detectionStore } from "@/store/detectionStore";
import { captureFrameBlob, hasThreat, summarizeDetections, toDataUrl } from "@/lib/inference";
import { playAlert } from "@/lib/alert";
import type { DetectResponse } from "@/types/detection";
import { Camera, CameraOff, Radio } from "lucide-react";
import { toast } from "sonner";

export function LiveInference() {
  const { status, detectFrame } = useApi();
  const settings = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [annotated, setAnnotated] = useState<string | null>(null);
  const [last, setLast] = useState<DetectResponse | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzingRef = useRef(false);
  const [fps, setFps] = useState(0);
  const lastAlertRef = useRef(0);

  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      streamRef.current = s;
      const v = videoRef.current!;
      v.srcObject = s;
      await v.play();
      setStreaming(true);
    } catch (e: any) {
      toast.error(e.message || "Camera access denied");
    }
  };

  const stop = () => {
    analyzingRef.current = false;
    setAnalyzing(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
    setAnnotated(null);
    setLast(null);
  };

  const loop = async () => {
    const v = videoRef.current;
    if (!v) return;
    let frames = 0;
    let bucket = performance.now();
    while (analyzingRef.current && streamRef.current) {
      const interval = 1000 / Math.max(1, settings.fps);
      const t0 = performance.now();
      try {
        const { blob } = await captureFrameBlob(v, 640, 0.6);
        const res = await detectFrame(blob);
        if (!analyzingRef.current) break;
        setLast(res);
        setAnnotated(toDataUrl(res.image_b64));
        if (hasThreat(res, settings.threshold)) {
          const now = Date.now();
          // throttle alerts/log to once every 2s to avoid spam
          if (now - lastAlertRef.current > 2000) {
            lastAlertRef.current = now;
            if (settings.alertSound) playAlert();
            const { topLabel, topConfidence } = summarizeDetections(res);
            detectionStore.add({
              id: crypto.randomUUID(),
              timestamp: now,
              source: "live",
              topLabel,
              topConfidence,
              total: res.total,
              counts: res.counts,
              snapshot: toDataUrl(res.image_b64),
            });
          }
        }
        frames++;
        if (performance.now() - bucket > 1000) {
          setFps(frames);
          frames = 0;
          bucket = performance.now();
        }
      } catch (e) {
        // swallow per-frame errors
      }
      const elapsed = performance.now() - t0;
      await new Promise((r) => setTimeout(r, Math.max(0, interval - elapsed)));
    }
  };

  const toggleAnalyze = () => {
    if (status !== "online") { toast.error("API endpoint is not reachable"); return; }
    if (!streaming) { toast.error("Start camera first"); return; }
    if (analyzing) {
      analyzingRef.current = false;
      setAnalyzing(false);
    } else {
      analyzingRef.current = true;
      setAnalyzing(true);
      loop();
    }
  };

  const threat = last && hasThreat(last, settings.threshold);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {!streaming ? (
          <Button onClick={start} variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-2" /> Start Camera
          </Button>
        ) : (
          <Button onClick={stop} variant="ghost" size="sm">
            <CameraOff className="h-4 w-4 mr-2" /> Stop Camera
          </Button>
        )}
        <Button onClick={toggleAnalyze} size="sm" disabled={!streaming || status !== "online"}>
          <Radio className={`h-4 w-4 mr-2 ${analyzing ? "animate-blink text-destructive" : ""}`} />
          {analyzing ? "Stop Surveillance" : "Begin Surveillance"}
        </Button>
        {analyzing && (
          <span className="text-[10px] text-primary tracking-widest font-bold ml-2">
            {fps} FPS · TARGET {settings.fps} · {last?.inference_ms?.toFixed(0) ?? "—"}ms
          </span>
        )}
      </div>

      <div className="relative aspect-video bg-secondary/40 border border-border rounded-sm overflow-hidden flex items-center justify-center">
        {/* Hidden raw video — we display the server-annotated frames when available */}
        <video
          ref={videoRef}
          playsInline muted
          className={`max-w-full max-h-full ${annotated ? "hidden" : ""}`}
        />
        {annotated && (
          <img src={annotated} alt="annotated" className="max-w-full max-h-full object-contain" />
        )}
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-muted-foreground">
            <Camera className="h-8 w-8 mb-2 opacity-40" />
            Camera offline
          </div>
        )}
        {analyzing && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-x-0 h-24 animate-scan"
              style={{ background: "var(--gradient-scan)" }}
            />
          </div>
        )}
        {threat && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest animate-pulse-threat">
            <span className="h-2 w-2 bg-destructive-foreground rounded-full" />
            THREAT · {last!.total}
          </div>
        )}
      </div>
    </div>
  );
}

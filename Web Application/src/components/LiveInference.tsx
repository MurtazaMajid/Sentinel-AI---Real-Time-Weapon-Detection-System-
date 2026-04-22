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
import { supabase } from "@/integrations/supabase/client";

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
  const lastEmailRef = useRef(0);

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
    // Allow up to 2 in-flight requests so a slow server doesn't freeze the preview
    const MAX_INFLIGHT = 2;
    let inflight = 0;

    const sendOne = async () => {
      inflight++;
      try {
        const { blob } = await captureFrameBlob(v, 480, 0.55);
        const res = await detectFrame(blob);
        if (!analyzingRef.current) return;
        setLast(res);
        setAnnotated(toDataUrl(res.image_b64));
        if (hasThreat(res, settings.threshold)) {
          const now = Date.now();
          if (now - lastAlertRef.current > 2000) {
            lastAlertRef.current = now;
            if (settings.alertSound) playAlert();
            const { topLabel, topConfidence } = summarizeDetections(res, settings.threshold);
            const weapons = res.detections?.filter((d) => d.confidence >= settings.threshold) ?? [];
            const snapshot = toDataUrl(res.image_b64);
            detectionStore.add({
              id: crypto.randomUUID(),
              timestamp: now,
              source: "live",
              topLabel,
              topConfidence,
              total: weapons.length || res.total,
              counts: res.counts,
              snapshot,
            });
            // Throttle email alerts: at most one every 30s
            if (now - lastEmailRef.current > 30_000) {
              lastEmailRef.current = now;
              const imageBase64 = snapshot.startsWith("data:")
                ? snapshot.split(",")[1]
                : snapshot;
              supabase.functions
                .invoke("send-threat-alert", {
                  body: {
                    label: topLabel,
                    confidence: topConfidence,
                    source: "Live camera",
                    timestamp: new Date(now).toISOString(),
                    imageBase64,
                  },
                })
                .then(({ error }) => {
                  if (error) console.error("Alert email failed", error);
                  else toast.success("Threat alert email sent", { duration: 2000 });
                })
                .catch((e) => console.error("Alert email failed", e));
            }
          }
        }
        frames++;
        if (performance.now() - bucket > 1000) {
          setFps(frames);
          frames = 0;
          bucket = performance.now();
        }
      } catch {
        /* swallow per-frame errors */
      } finally {
        inflight--;
      }
    };

    let lastDispatch = 0;
    while (analyzingRef.current && streamRef.current) {
      const interval = 1000 / Math.max(1, settings.fps);
      const now = performance.now();
      if (inflight < MAX_INFLIGHT && now - lastDispatch >= interval) {
        lastDispatch = now;
        sendOne();
      }
      // Yield to the browser so the <video> element keeps painting smoothly
      await new Promise((r) => requestAnimationFrame(() => r(null)));
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
        {/* Always show the live webcam for smooth preview */}
        <video
          ref={videoRef}
          playsInline muted
          className="max-w-full max-h-full"
        />
        {/* Server-annotated frame overlaid only when a weapon is detected */}
        {annotated && analyzing && threat && (
          <img
            src={annotated}
            alt="annotated"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
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
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest animate-pulse-threat z-10">
            <span className="h-2 w-2 bg-destructive-foreground rounded-full" />
            WEAPON · {last ? (last.detections?.filter((d) => d.confidence >= settings.threshold).length || last.total) : 0}
          </div>
        )}
      </div>
    </div>
  );
}

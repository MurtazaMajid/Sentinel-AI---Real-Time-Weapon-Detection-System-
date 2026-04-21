import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApi } from "./ConnectionPanel";
import { useSettings } from "@/store/settings";
import { detectionStore } from "@/store/detectionStore";
import { captureFrameBlob, hasThreat, summarizeDetections, toDataUrl } from "@/lib/inference";
import { playAlert } from "@/lib/alert";
import type { DetectResponse } from "@/types/detection";
import { Upload, Play, Pause, Loader2, FileVideo, Send } from "lucide-react";
import { toast } from "sonner";

type Mode = "stream" | "upload";

export function VideoInference() {
  const { status, detectFrame, detectVideo } = useApi();
  const settings = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [annotated, setAnnotated] = useState<string | null>(null);
  const [last, setLast] = useState<DetectResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; counts: Record<string, number> } | null>(null);
  const [mode, setMode] = useState<Mode>("stream");
  const runningRef = useRef(false);
  const lastAlertRef = useRef(0);

  useEffect(() => () => { runningRef.current = false; }, []);

  const onFile = (f: File) => {
    setLast(null);
    setAnnotated(null);
    setSummary(null);
    setFile(f);
    setSrc(URL.createObjectURL(f));
  };

  const loop = async () => {
    const v = videoRef.current;
    if (!v) return;
    const interval = 1000 / Math.max(1, settings.fps);
    while (runningRef.current && !v.paused && !v.ended) {
      const t0 = performance.now();
      try {
        const { blob } = await captureFrameBlob(v, 640, 0.7);
        const res = await detectFrame(blob);
        if (!runningRef.current) break;
        setLast(res);
        setAnnotated(toDataUrl(res.image_b64));
        if (hasThreat(res, settings.threshold)) {
          const now = Date.now();
          if (now - lastAlertRef.current > 2000) {
            lastAlertRef.current = now;
            if (settings.alertSound) playAlert();
            const { topLabel, topConfidence } = summarizeDetections(res);
            detectionStore.add({
              id: crypto.randomUUID(),
              timestamp: now,
              source: "video",
              topLabel,
              topConfidence,
              total: res.total,
              counts: res.counts,
              snapshot: toDataUrl(res.image_b64),
            });
          }
        }
      } catch (e) {
        console.warn(e);
      }
      const elapsed = performance.now() - t0;
      await new Promise((r) => setTimeout(r, Math.max(0, interval - elapsed)));
    }
    runningRef.current = false;
    setRunning(false);
  };

  const toggleStream = () => {
    const v = videoRef.current;
    if (!v) return;
    if (status !== "online") { toast.error("API endpoint is not reachable"); return; }
    if (running) {
      runningRef.current = false;
      v.pause();
      setRunning(false);
    } else {
      runningRef.current = true;
      setRunning(true);
      v.play();
      loop();
    }
  };

  const uploadFull = async () => {
    if (!file) { toast.error("Upload a video first"); return; }
    if (status !== "online") { toast.error("API endpoint is not reachable"); return; }
    setUploading(true);
    setSummary(null);
    try {
      const res = await detectVideo(file, file.name);
      setSummary({ total: res.total || 0, counts: res.counts || {} });
      if (res.weapon_alert || res.total > 0) {
        if (settings.alertSound) playAlert();
        const counts = res.counts || {};
        const [topLabel] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["THREAT", 0];
        // Use first frame snapshot if available
        const firstFrame = res.frames?.find((f) => f.image_b64);
        const snapshot = firstFrame?.image_b64 ? toDataUrl(firstFrame.image_b64) : (src || "");
        detectionStore.add({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: "video",
          topLabel: String(topLabel).toUpperCase(),
          topConfidence: 0,
          total: res.total || 0,
          counts,
          snapshot,
        });
        toast.error(`${res.total} threat${res.total !== 1 ? "s" : ""} across video`);
      } else {
        toast.success("No threats detected in video");
      }
    } catch (e: any) {
      toast.error(e.message || "Video analysis failed");
    } finally {
      setUploading(false);
    }
  };

  const threat = last && hasThreat(last, settings.threshold);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <label>
          <input
            type="file" accept="video/*" hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button asChild variant="outline" size="sm">
            <span><Upload className="h-4 w-4 mr-2" />Upload Video</span>
          </Button>
        </label>

        <div className="flex border border-border rounded-sm overflow-hidden text-xs">
          <button
            onClick={() => setMode("stream")}
            className={`px-3 py-1.5 ${mode === "stream" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}
          >
            Frame-by-frame
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`px-3 py-1.5 ${mode === "upload" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}
          >
            Full upload
          </button>
        </div>

        {mode === "stream" ? (
          <Button onClick={toggleStream} disabled={!src || status !== "online"} size="sm">
            {running ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Pause" : "Start"} Analysis
          </Button>
        ) : (
          <Button onClick={uploadFull} disabled={!file || uploading || status !== "online"} size="sm">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to /detect/video
          </Button>
        )}
        {running && <Loader2 className="h-4 w-4 animate-spin text-primary self-center" />}
      </div>

      <div className="relative aspect-video bg-secondary/40 border border-border rounded-sm overflow-hidden flex items-center justify-center">
        {src ? (
          <>
            <video
              ref={videoRef}
              src={src}
              controls={!running}
              className={`max-w-full max-h-full ${mode === "stream" && annotated ? "hidden" : ""}`}
            />
            {mode === "stream" && annotated && (
              <img src={annotated} alt="annotated" className="absolute inset-0 m-auto max-w-full max-h-full object-contain" />
            )}
            {(running || uploading) && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-x-0 h-24 animate-scan"
                  style={{ background: "var(--gradient-scan)" }}
                />
              </div>
            )}
            {mode === "stream" && threat && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest animate-pulse-threat">
                <span className="h-2 w-2 bg-destructive-foreground rounded-full" />
                THREAT · {last!.total}
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-xs text-muted-foreground p-8">
            <FileVideo className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Upload a video file to scan
          </div>
        )}
      </div>

      {summary && (
        <div className="panel p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="tracking-widest text-muted-foreground">SUMMARY</span>
            <span className="text-primary font-bold">{summary.total} total</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.counts).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 bg-secondary border border-border rounded-sm">
                {k.toUpperCase()} <span className="text-primary font-bold">×{v}</span>
              </span>
            ))}
            {Object.keys(summary.counts).length === 0 && (
              <span className="text-muted-foreground">No detections</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

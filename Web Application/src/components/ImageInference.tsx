import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApi } from "./ConnectionPanel";
import { useSettings } from "@/store/settings";
import { detectionStore } from "@/store/detectionStore";
import { captureFrameBlob, hasThreat, summarizeDetections, toDataUrl } from "@/lib/inference";
import { playAlert } from "@/lib/alert";
import type { DetectResponse } from "@/types/detection";
import { Upload, Loader2, Scan } from "lucide-react";
import { toast } from "sonner";

export function ImageInference() {
  const { status, detectImage } = useApi();
  const settings = useSettings();
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = (f: File) => {
    setResult(null);
    setOriginalFile(f);
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(f);
  };

  const run = async () => {
    if (!originalFile) {
      toast.error("Load an image");
      return;
    }
    if (status !== "online") {
      toast.error("API endpoint is not reachable");
      return;
    }
    setBusy(true);
    try {
      const res = await detectImage(originalFile, originalFile.name);
      setResult(res);
      const annotated = toDataUrl(res.image_b64);
      if (hasThreat(res, settings.threshold)) {
        if (settings.alertSound) playAlert();
        const { topLabel, topConfidence } = summarizeDetections(res, settings.threshold);
        detectionStore.add({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: "image",
          topLabel,
          topConfidence,
          total: res.total,
          counts: res.counts,
          snapshot: annotated,
        });
        toast.error(`Weapon detected · ${topLabel}`);
      } else {
        toast.success("No threats detected");
      }
    } catch (e: any) {
      toast.error(e.message || "Inference failed");
    } finally {
      setBusy(false);
    }
  };

  const annotated = result ? toDataUrl(result.image_b64) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label>
          <input
            type="file" accept="image/*" hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button asChild variant="outline" size="sm">
            <span><Upload className="h-4 w-4 mr-2" />Upload Image</span>
          </Button>
        </label>
        <Button onClick={run} disabled={!src || busy || status !== "online"} size="sm">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scan className="h-4 w-4 mr-2" />}
          Analyze
        </Button>
        {result && (
          <span className="text-[10px] tracking-widest text-muted-foreground self-center ml-2">
            {result.inference_ms?.toFixed(0)}ms · {result.total} OBJ
          </span>
        )}
      </div>

      <div className="relative aspect-video bg-secondary/40 border border-border rounded-sm overflow-hidden flex items-center justify-center">
        {annotated ? (
          <img src={annotated} alt="annotated" className="max-w-full max-h-full object-contain" />
        ) : src ? (
          <img
            ref={imgRef}
            src={src}
            alt="target"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center text-xs text-muted-foreground p-8">
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Upload an image to begin analysis
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-x-0 h-24 animate-scan"
              style={{ background: "var(--gradient-scan)" }}
            />
          </div>
        )}
        {result && hasThreat(result, settings.threshold) && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest animate-pulse-threat">
            <span className="h-2 w-2 bg-destructive-foreground rounded-full" />
            THREAT · {result.total}
          </div>
        )}
      </div>
    </div>
  );
}

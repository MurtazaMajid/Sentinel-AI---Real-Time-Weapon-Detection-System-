import { useCallback, useEffect, useRef, useState } from "react";
import type { DetectResponse, DetectVideoResponse } from "@/types/detection";

export type ApiStatus = "idle" | "checking" | "online" | "offline";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export function useInferenceApi(baseUrl: string | null) {
  const [status, setStatus] = useState<ApiStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    if (!baseUrl) {
      setStatus("idle");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("checking");
    try {
      const res = await fetch(joinUrl(baseUrl, "/health"), { signal: ctrl.signal });
      setStatus(res.ok ? "online" : "offline");
    } catch {
      if (!ctrl.signal.aborted) setStatus("offline");
    }
  }, [baseUrl]);

  useEffect(() => {
    checkHealth();
    const id = window.setInterval(checkHealth, 30_000);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [checkHealth]);

  const detectImage = useCallback(
    async (file: Blob, filename = "image.jpg"): Promise<DetectResponse> => {
      if (!baseUrl) throw new Error("API URL not set");
      const fd = new FormData();
      fd.append("file", file, filename);
      const res = await fetch(joinUrl(baseUrl, "/detect/image"), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Detect image failed (${res.status})`);
      return res.json();
    },
    [baseUrl]
  );

  const detectFrame = useCallback(
    async (file: Blob, filename = "frame.jpg"): Promise<DetectResponse> => {
      if (!baseUrl) throw new Error("API URL not set");
      const fd = new FormData();
      fd.append("file", file, filename);
      const res = await fetch(joinUrl(baseUrl, "/detect/frame"), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Detect frame failed (${res.status})`);
      return res.json();
    },
    [baseUrl]
  );

  const detectVideo = useCallback(
    async (file: Blob, filename = "video.mp4"): Promise<DetectVideoResponse> => {
      if (!baseUrl) throw new Error("API URL not set");
      const fd = new FormData();
      fd.append("file", file, filename);
      const res = await fetch(joinUrl(baseUrl, "/detect/video"), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Detect video failed (${res.status})`);
      return res.json();
    },
    [baseUrl]
  );

  return { status, checkHealth, detectImage, detectFrame, detectVideo };
}

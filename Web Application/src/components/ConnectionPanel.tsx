import { useSettings, settingsStore } from "@/store/settings";
import { useInferenceApi, type ApiStatus } from "@/hooks/useInferenceApi";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Plug, PlugZap, Zap, RefreshCw } from "lucide-react";

interface Ctx {
  status: ApiStatus;
  detectImage: ReturnType<typeof useInferenceApi>["detectImage"];
  detectFrame: ReturnType<typeof useInferenceApi>["detectFrame"];
  detectVideo: ReturnType<typeof useInferenceApi>["detectVideo"];
  checkHealth: () => void;
}
const ApiCtx = createContext<Ctx | null>(null);

export function useApi() {
  const c = useContext(ApiCtx);
  if (!c) throw new Error("useApi inside SocketProvider");
  return c;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const url = settings.apiUrl?.trim() || null;
  const { status, detectImage, detectFrame, detectVideo, checkHealth } = useInferenceApi(url);
  const value = useMemo(
    () => ({ status, detectImage, detectFrame, detectVideo, checkHealth }),
    [status, detectImage, detectFrame, detectVideo, checkHealth]
  );
  return <ApiCtx.Provider value={value}>{children}</ApiCtx.Provider>;
}

const statusMeta: Record<ApiStatus, { label: string; color: string; icon: typeof Plug }> = {
  idle: { label: "IDLE", color: "text-muted-foreground", icon: Plug },
  checking: { label: "PROBING", color: "text-primary animate-blink", icon: Zap },
  online: { label: "ONLINE", color: "text-safe", icon: PlugZap },
  offline: { label: "OFFLINE", color: "text-destructive animate-blink", icon: Plug },
};

export function ConnectionPanel() {
  const settings = useSettings();
  const { status, checkHealth } = useApi();
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <div className="panel panel-corner p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm">Inference Endpoint</h3>
        <div className={`flex items-center gap-2 text-xs font-bold tracking-widest ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="api" className="text-xs uppercase tracking-wider text-muted-foreground">
          API Base URL
        </Label>
        <Input
          id="api"
          placeholder="https://your-api.hf.space"
          value={settings.apiUrl}
          onChange={(e) => settingsStore.set({ apiUrl: e.target.value })}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          REST endpoints: <code className="text-foreground">/detect/image</code>,{" "}
          <code className="text-foreground">/detect/video</code>,{" "}
          <code className="text-foreground">/detect/frame</code>
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={checkHealth} disabled={!settings.apiUrl}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Test Connection
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Threshold
          </Label>
          <span className="text-xs font-bold text-primary">{(settings.threshold * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[settings.threshold]}
          min={0.1} max={0.95} step={0.05}
          onValueChange={([v]) => settingsStore.set({ threshold: v })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Live FPS</Label>
          <span className="text-xs font-bold text-primary">{settings.fps}/s</span>
        </div>
        <Slider
          value={[settings.fps]}
          min={1} max={8} step={1}
          onValueChange={([v]) => settingsStore.set({ fps: v })}
        />
        <p className="text-[10px] text-muted-foreground">Recommended 2–4 fps for hosted endpoints.</p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="snd" className="text-xs uppercase tracking-wider text-muted-foreground">
          Alert sound
        </Label>
        <Switch
          id="snd"
          checked={settings.alertSound}
          onCheckedChange={(c) => settingsStore.set({ alertSound: c })}
        />
      </div>
    </div>
  );
}

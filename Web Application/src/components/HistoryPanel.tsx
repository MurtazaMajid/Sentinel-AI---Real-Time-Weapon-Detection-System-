import { useDetectionHistory, detectionStore } from "@/store/detectionStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Trash2, Camera, Video, Radio } from "lucide-react";

const sourceIcon = { image: Camera, video: Video, live: Radio };

export function HistoryPanel() {
  const events = useDetectionHistory();

  return (
    <div className="panel panel-corner flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          Detection Log
          <span className="text-xs text-muted-foreground font-normal normal-case">
            ({events.length})
          </span>
        </h3>
        <Button
          size="sm" variant="ghost"
          onClick={() => detectionStore.clear()}
          disabled={!events.length}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {events.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No threats logged. System monitoring.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((ev) => {
              const Icon = sourceIcon[ev.source];
              return (
                <li key={ev.id} className="p-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex gap-3">
                    {ev.snapshot ? (
                      <img
                        src={ev.snapshot}
                        alt="snapshot"
                        className="w-16 h-16 object-cover border border-destructive/60 rounded-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-secondary border border-border rounded-sm flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <Icon className="h-3 w-3 text-primary" />
                        <span className="text-destructive font-bold uppercase tracking-wider truncate">
                          {ev.topLabel}
                        </span>
                        {ev.topConfidence > 0 && (
                          <span className="text-primary">{(ev.topConfidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(ev.timestamp).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {ev.total} object{ev.total !== 1 ? "s" : ""}
                        {Object.keys(ev.counts).length > 1 && (
                          <> · {Object.entries(ev.counts).map(([k, v]) => `${k}×${v}`).join(", ")}</>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

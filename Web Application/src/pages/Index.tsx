import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConnectionPanel, SocketProvider } from "@/components/ConnectionPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ImageInference } from "@/components/ImageInference";
import { VideoInference } from "@/components/VideoInference";
import { LiveInference } from "@/components/LiveInference";
import { Camera, Film, Radio, ShieldAlert } from "lucide-react";

const Index = () => {
  return (
    <SocketProvider>
      <div className="min-h-screen">
        {/* Top bar */}
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
          <div className="container flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShieldAlert className="h-7 w-7 text-primary text-glow-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive rounded-full animate-blink" />
              </div>
              <div>
                <h1 className="text-lg leading-none">Sentinel<span className="text-primary">/</span>CV</h1>
                <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
                  WEAPON DETECTION SYSTEM · v1.0
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[10px] tracking-widest text-muted-foreground">
              <span>STATUS</span>
              <span className="text-safe">● OPERATIONAL</span>
            </div>
          </div>
        </header>

        <main className="container py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Center: inference */}
          <section className="space-y-4">
            <Tabs defaultValue="live">
              <TabsList className="bg-secondary/50 border border-border">
                <TabsTrigger value="live" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Radio className="h-3.5 w-3.5 mr-2" /> Live
                </TabsTrigger>
                <TabsTrigger value="video" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Film className="h-3.5 w-3.5 mr-2" /> Video
                </TabsTrigger>
                <TabsTrigger value="image" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Camera className="h-3.5 w-3.5 mr-2" /> Image
                </TabsTrigger>
              </TabsList>

              <div className="panel panel-corner p-4 mt-4">
                <TabsContent value="live" className="mt-0"><LiveInference /></TabsContent>
                <TabsContent value="video" className="mt-0"><VideoInference /></TabsContent>
                <TabsContent value="image" className="mt-0"><ImageInference /></TabsContent>
              </div>
            </Tabs>

            <div className="panel p-3 text-[10px] text-muted-foreground tracking-wider leading-relaxed">
              <span className="text-primary">PROTOCOL </span>
              Frames are sent as multipart JPEG to the FastAPI server
              (<code className="text-foreground mx-1">POST /detect/image</code>,
              <code className="text-foreground mx-1">/detect/frame</code>,
              <code className="text-foreground mx-1">/detect/video</code>). Server returns an
              annotated <code className="text-foreground mx-1">image_b64</code>,
              per-class <code className="text-foreground mx-1">counts</code> and a
              <code className="text-foreground mx-1">weapon_alert</code> flag.
            </div>
          </section>

          {/* Right: settings + history */}
          <aside className="space-y-4 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] flex flex-col">
            <ConnectionPanel />
            <div className="flex-1 min-h-[300px]">
              <HistoryPanel />
            </div>
          </aside>
        </main>
      </div>
    </SocketProvider>
  );
};

export default Index;

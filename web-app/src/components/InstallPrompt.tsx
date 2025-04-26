import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const shouldShow = isIOS && !isStandalone && !isDismissed;

    setShowPrompt(shouldShow);

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      setShowPrompt(shouldShow);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isDismissed]);

  if (!showPrompt || isDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[380px] p-4 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg z-50">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium mb-1">Install this app</p>
          <p className="text-sm text-muted-foreground">
            Tap <Share className="inline h-4 w-4" /> and then &quot;Add to Home
            Screen&quot; for the best experience
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}

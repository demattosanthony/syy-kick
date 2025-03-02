"use client";

import { Camera, Hand, Rotate3D, PersonStanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useEffect, ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import { aiModeAtom, worldAtom } from "@/atoms/ifc-viewer-state";

type CameraMode = {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut: string;
};

export default function IfcViewerToolbar() {
  const cameraModes: CameraMode[] = [
    {
      id: "Orbit",
      label: "Orbit",
      icon: <Rotate3D className="h-4 w-4" />,
      shortcut: "O",
    },
    {
      id: "Plan",
      label: "Hand Tool",
      icon: <Hand className="h-4 w-4" />,
      shortcut: "H",
    },
    {
      id: "FirstPerson",
      label: "First Person",
      icon: <PersonStanding className="h-4 w-4" />,
      shortcut: "F",
    },
  ];

  const [aiMode, setAiMode] = useAtom(aiModeAtom);
  const world = useAtomValue(worldAtom);
  const [selectedMode, setSelectedMode] = useState<CameraMode>(cameraModes[0]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isOrthographic, setIsOrthographic] = useState(false);

  const toggleAiMode = () => {
    setAiMode(!aiMode);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      //   world?.renderer?.resize();
      //   world?.camera?.updateAspect();
    }, 200);
  };

  const handleCameraModeChange = (mode: CameraMode) => {
    setSelectedMode(mode);
    let thisWorld: any = world;
    const { current } = thisWorld.camera.projection;
    const isOrtho = current === "Orthographic";
    const isFirstPerson = mode.id === "FirstPerson";

    if (isOrtho && isFirstPerson) {
      thisWorld.camera.projection.set("Perspective");
      setIsOrthographic(false);
    }
    thisWorld.camera.set(mode.id);

    const viewerElement = document.getElementById("ifc-viewer");
    if (viewerElement) {
      viewerElement.style.cursor = mode.id === "Plan" ? "grab" : "default";
    }
  };

  const toggleProjection = () => {
    let thisWorld: any = world;
    const newProjection = isOrthographic ? "Perspective" : "Orthographic";

    // Automatically switch to perspective mode if in first person
    if (selectedMode.id === "FirstPerson" && newProjection === "Orthographic") {
      thisWorld.camera.projection.set("Perspective");
      setIsOrthographic(false);
    }

    thisWorld.camera.projection.set(newProjection);
    setIsOrthographic(!isOrthographic);
  };

  const captureScreen = async () => {
    try {
      setIsCapturing(true);
      const thisWorld: any = world;
      if (!thisWorld?.renderer) {
        throw new Error("Renderer not found");
      }

      // Get the Three.js renderer
      const renderer = thisWorld.renderer.three;
      const scene = thisWorld.scene.three;
      const camera = thisWorld.camera.three;

      // Force a render of the scene
      renderer.render(scene, camera);

      // Make sure to preserve the renderer's original settings
      const originalPreserveDrawingBuffer = renderer.preserveDrawingBuffer;
      renderer.preserveDrawingBuffer = true;

      // Render again with preserveDrawingBuffer enabled
      renderer.render(scene, camera);

      // Capture the image data
      const imgData = renderer.domElement.toDataURL("image/png");

      // Restore original preserveDrawingBuffer setting
      renderer.preserveDrawingBuffer = originalPreserveDrawingBuffer;

      // Create a link element and trigger download
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `screenshot-${new Date().toISOString()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to capture screen:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Add AI chat toggle shortcut (CMD + L)
      if (event.key.toLowerCase() === "l" && event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleAiMode();
      }

      // Ignore key presses if the user is typing in an input field
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      const mode = cameraModes.find(
        (m) => m.shortcut.toLowerCase() === event.key.toLowerCase()
      );
      if (mode) {
        handleCameraModeChange(mode);
      }
      // Add screenshot shortcut (Ctrl/Cmd + S)
      if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        captureScreen();
      }
      // Add projection toggle shortcut (P)
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        toggleProjection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraModes, selectedMode.id, isOrthographic]);

  return (
    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
      <div className="flex items-center gap-1 p-1.5 bg-background rounded-lg border shadow-lg">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              {selectedMode.icon}
              <span className="sr-only">Select camera mode</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0" align="start">
            <div className="bg-background rounded-lg">
              {cameraModes.map((mode) => (
                <Button
                  key={mode.id}
                  variant="ghost"
                  className="w-full justify-between px-3 py-2 text-sm font-normal"
                  onClick={() => handleCameraModeChange(mode)}
                >
                  <div className="flex items-center gap-2">
                    {mode.icon}
                    {mode.label}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {mode.shortcut}
                  </span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={toggleProjection}
          title={`Switch to ${
            isOrthographic ? "Perspective" : "Orthographic"
          } view (P)`}
        >
          {isOrthographic ? (
            <Box className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle projection</span>
        </Button> */}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={captureScreen}
          disabled={isCapturing}
        >
          <Camera className="h-4 w-4" />
          <span className="sr-only">Take screenshot</span>
        </Button>
      </div>
    </div>
  );
}

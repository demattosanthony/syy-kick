import { useCallback } from "react";
import * as OBC from "@thatopen/components";
import { OrientationGizmo } from "@/components/viewers/ifc/ifc-orientation-gizmo";
import {
  worldAtom,
  cameraAtom,
  componentsAtom,
  fragmentsAtom,
  cullerAtom,
  highlighterAtom,
  hiderAtom,
  resetAtom,
} from "@/atoms/ifc-viewer-state";
import { useSetAtom } from "jotai";
import {
  createWorld,
  setupCuller,
  setupFragments,
  setupHider,
  setupHighlighter,
  setupStats,
} from "@/lib/ifc-viewer-utils";

export function useIfcViewer(containerId: string) {
  const setWorld = useSetAtom(worldAtom);
  const setCamera = useSetAtom(cameraAtom);
  const setComponents = useSetAtom(componentsAtom);
  const setFragments = useSetAtom(fragmentsAtom);
  const setCuller = useSetAtom(cullerAtom);
  const setHighlighter = useSetAtom(highlighterAtom);
  const setHider = useSetAtom(hiderAtom);
  const reset = useSetAtom(resetAtom);

  const initializeViewer = useCallback(async () => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const components = new OBC.Components();
      const world = createWorld(components, container);
      const fragments = await setupFragments(components);
      const highlighter = setupHighlighter(world, components);
      const culler = setupCuller(world, components);
      const hider = setupHider(components);
      setupStats(world, container);

      setComponents(components);
      setWorld(world);
      setFragments(fragments);
      setHighlighter(highlighter);
      setCamera(world.camera);
      setCuller(culler);
      setHider(hider);

      // Add the orientation gizmo component
      new OrientationGizmo(components, world);

      // Handlw window resize
      const handleResize = () => {
        console.log("Resizing");
        world?.renderer?.resize();
        world?.camera?.updateAspect();
      };
      window.addEventListener("resize", handleResize);

      // Handle control events
      world.camera.controls.addEventListener("controlend", () => {
        culler.needsUpdate = true;
      });

      world.camera.updateAspect();

      return () => {
        world?.dispose();
        fragments?.dispose();
        highlighter?.dispose();
        components?.dispose();
        culler?.dispose();
        reset();
      };
    } catch (error) {
      console.error("Failed to initialize viewer:", error);
    }
  }, [containerId]);

  return { initializeViewer };
}

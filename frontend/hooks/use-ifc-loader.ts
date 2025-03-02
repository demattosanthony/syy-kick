import { useCallback } from "react";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { FragmentsGroup } from "@thatopen/fragments";
import { useAtomValue, useSetAtom } from "jotai";
import {
  isLoadingAtom,
  worldAtom,
  componentsAtom,
  cullerAtom,
  plansAtom,
  addModelAtom,
  categoriesAtom,
  modelsAtom,
  clearModelsAtom,
  highlighterAtom,
} from "@/atoms/ifc-viewer-state";

export function useIfcLoader() {
  const setLoading = useSetAtom(isLoadingAtom);
  const world = useAtomValue(worldAtom);
  const components = useAtomValue(componentsAtom);
  const culler = useAtomValue(cullerAtom);
  const setPlans = useSetAtom(plansAtom);
  const addModel = useSetAtom(addModelAtom);
  const categories = useAtomValue(categoriesAtom);
  const setCategories = useSetAtom(categoriesAtom);
  const models = useAtomValue(modelsAtom);
  const clearModels = useSetAtom(clearModelsAtom);
  const highlighter = useAtomValue(highlighterAtom);
  const plans = useAtomValue(plansAtom);
  const setHighlighter = useSetAtom(highlighterAtom);

  //   const { focusOnModels } = useCameraFocus();

  /**
   * Loads an IFC file, processes it, and adds it to the scene.
   */
  const loadIfcFile = useCallback(
    async (file: File): Promise<FragmentsGroup | null> => {
      if (!world || !components) {
        console.error("World or components not initialized.");
        return null;
      }
      const fragmentIfcLoader = components.get(OBC.IfcLoader);

      setLoading(true);
      try {
        const data = await file.arrayBuffer();
        const buffer = new Uint8Array(data);
        const model = await fragmentIfcLoader.load(buffer);
        model.name = file.name;

        world.scene.three.add(model);

        model.position.set(0, 0, 0);

        // Add instanced meshes to the culler if necessary
        const FILE_SIZE_THRESHOLD_FOR_CULLING = 100 * 1024 * 1024; // 100MB
        const fileSizeInBytes = file.size;
        if (culler && fileSizeInBytes > FILE_SIZE_THRESHOLD_FOR_CULLING) {
          model.traverse((child) => {
            if (child instanceof THREE.InstancedMesh) {
              culler.add(child);
            }
          });
        }

        const fragmentBbox = components.get(OBC.BoundingBoxer);
        fragmentBbox.add(model);
        const bbox = fragmentBbox.getMesh();
        fragmentBbox.reset();
        world.camera.controls?.fitToSphere(bbox, true);

        const indexer = components.get(OBC.IfcRelationsIndexer);
        if (model.hasProperties) {
          await indexer.process(model);
        }

        // Define the inverse attributes to traverse
        const inverseAttributes: OBC.InverseAttribute[] = [
          "IsDecomposedBy",
          "ContainsElements",
        ];

        addModel({
          fragmentsGroup: model,
          name: file.name,
          content: file,
          tree: null,
        });

        return model;
      } catch (error) {
        console.error("Error loading IFC file:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addModel, setPlans, world, components, culler, highlighter]
  );

  /**
   * Completely unload and clear all IFC models from scene and store.
   */
  const unloadAllIfcFiles = useCallback(async () => {
    if (!world || !components) return;

    setLoading(true);

    try {
      if (plans) {
        plans.dispose();
        setPlans(null);
      }

      const fragments = components.get(OBC.FragmentsManager);

      // 4. Remove models from scene and dispose
      for (const { fragmentsGroup } of models) {
        fragments.disposeGroup(fragmentsGroup);

        // Remove from culler first
        if (culler) {
          fragmentsGroup.traverse((child) => {
            if (child instanceof THREE.InstancedMesh) {
              culler.remove(child);
            }
          });
        }
        // Remove from scene
        world.scene?.three.remove(fragmentsGroup);

        fragmentsGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }

      clearModels();
    } catch (error) {
      console.error("Failed to unload IFC models:", error);
    } finally {
      setLoading(false);
    }
  }, [world, components, models, culler, highlighter, plans]);

  //   useEffect(() => {
  //     focusOnModels();
  //   }, [models]);

  return { loadIfcFile, unloadAllIfcFiles };
}

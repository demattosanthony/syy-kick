import { atom } from "jotai";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import { EntityNode, IFCCategory, IFCModel } from "@/types/ifc";

// Base atoms for individual state pieces
export const worldAtom = atom<OBC.World | null>(null);
export const cameraAtom = atom<OBC.OrthoPerspectiveCamera | null>(null);
export const componentsAtom = atom<OBC.Components | null>(null);
export const fragmentsAtom = atom<OBC.FragmentsManager | null>(null);
export const highlighterAtom = atom<OBCF.Highlighter | null>(null);
export const cullerAtom = atom<OBC.MeshCullerRenderer | null>(null);
export const modelsAtom = atom<IFCModel[]>([]);
export const categoriesAtom = atom<Record<string, IFCCategory>>({});
export const selectedElementAtom = atom<EntityNode | null>(null);
export const isLoadingAtom = atom<boolean>(true);
export const plansAtom = atom<OBCF.Plans | null>(null);
export const hiderAtom = atom<OBC.Hider | null>(null);
export const aiModeAtom = atom<boolean>(false);

// Derived atoms for actions
export const addModelAtom = atom(null, (get, set, model: IFCModel) => {
  const currentModels = get(modelsAtom);
  set(modelsAtom, [...currentModels.map((m) => ({ ...m })), { ...model }]);
});

export const clearModelsAtom = atom(null, (_, set) => {
  set(modelsAtom, []);
  set(categoriesAtom, {});
  set(selectedElementAtom, null);
});

export const resetAtom = atom(null, (_, set) => {
  set(worldAtom, null);
  set(cameraAtom, null);
  set(componentsAtom, null);
  set(fragmentsAtom, null);
  set(highlighterAtom, null);
  set(modelsAtom, []);
  set(categoriesAtom, {});
  set(selectedElementAtom, null);
  set(isLoadingAtom, true);
  set(plansAtom, null);
  set(hiderAtom, null);
  set(cullerAtom, null);
  set(aiModeAtom, false);
});

// Optional: Combined atom for reading the entire state at once
export const viewerStateAtom = atom((get) => ({
  world: get(worldAtom),
  camera: get(cameraAtom),
  components: get(componentsAtom),
  fragments: get(fragmentsAtom),
  highlighter: get(highlighterAtom),
  culler: get(cullerAtom),
  models: get(modelsAtom),
  categories: get(categoriesAtom),
  selectedElement: get(selectedElementAtom),
  isLoading: get(isLoadingAtom),
  plans: get(plansAtom),
  hider: get(hiderAtom),
  aiMode: get(aiModeAtom),
}));

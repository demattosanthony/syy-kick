import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import Stats from "stats.js";

function createWorld(components: OBC.Components, container: HTMLElement) {
  const world = components
    .get(OBC.Worlds)
    .create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();

  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.OrthoPerspectiveCamera(components);

  components.init();
  world.camera.controls.setLookAt(6, 3, 4, 0, 0, -5);
  world.scene.setup();
  world.scene.three.background = null;

  const grids = components.get(OBC.Grids);
  grids.create(world);

  return world;
}

async function setupFragments(components: OBC.Components) {
  const fragments = components.get(OBC.FragmentsManager);
  const fragmentIfcLoader = components.get(OBC.IfcLoader);
  await fragmentIfcLoader.setup();

  // Configure excluded categories
  const excludedCats = [
    WEBIFC.IFCTENDONANCHOR,
    WEBIFC.IFCREINFORCINGBAR,
    WEBIFC.IFCREINFORCINGELEMENT,
    WEBIFC.IFCSPACE,
  ];

  excludedCats.forEach((cat) =>
    fragmentIfcLoader.settings.excludedCategories.add(cat)
  );

  fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

  return fragments;
}

function setupHighlighter(world: OBC.World, components: OBC.Components) {
  try {
    const highlighter = components.get(OBCF.Highlighter);
    highlighter.setup({
      world,
      hoverColor: new THREE.Color(0x0b99ff),
      selectionColor: new THREE.Color(0x0b99ff),
    });
    highlighter.zoomToSelection = false;
    return highlighter;
  } catch (err) {
    throw new Error("Failed to setup highlighter: " + err);
  }
}

function setupCuller(
  world: OBC.World,
  components: OBC.Components,
  threshold: number = 20
) {
  const cullers = components.get(OBC.Cullers);
  const culler = cullers.create(world);
  culler.config.threshold = threshold;
  return culler;
}

function setupStats(world: OBC.World, container: HTMLElement | null = null) {
  if (!world.renderer) {
    console.error("Renderer not found");
    return;
  }
  const stats = new Stats();
  stats.showPanel(0); // 0 shows FPS by default
  if (container) {
    container.append(stats.dom);
    stats.dom.style.position = "absolute"; // Ensure absolute positioning
    stats.dom.style.top = "0px"; // Adjust top position
    stats.dom.style.left = "0px"; // Adjust left position
    stats.dom.style.zIndex = "10"; // Ensure it is above other elements
  }
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());
}

function setupHider(components: OBC.Components) {
  return components.get(OBC.Hider);
}

export {
  createWorld,
  setupFragments,
  setupHighlighter,
  setupCuller,
  setupStats,
  setupHider,
};

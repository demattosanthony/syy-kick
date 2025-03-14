"use client";

import { useTheme } from "next-themes";
import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export default function STLViewer({
  file,
  size,
  animate = true,
  color,
}: {
  file: File | null;
  size: number;
  animate?: boolean;
  color?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!mountRef.current || !file) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;

    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        renderer.setSize(size, size);
      }
    };

    try {
      scene = new THREE.Scene();
      scene.background = null;

      // Use a slightly wider field of view to better fill the canvas
      camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
      camera.position.z = 5;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(size, size);
      mountRef.current.appendChild(renderer.domElement);

      // Lighting adjustments
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);

      // Main light from directly above
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
      directionalLight.position.set(0, 10, 0);
      scene.add(directionalLight);

      // Secondary light for some fill from the front
      const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.5);
      secondaryLight.position.set(0, 0, 5);
      scene.add(secondaryLight);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 0.8;
      controls.enableZoom = false;
      controls.autoRotate = animate;
      controls.autoRotateSpeed = 1.0;

      const loader = new STLLoader();
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const stlString = e.target?.result;
          if (
            typeof stlString !== "string" &&
            !(stlString instanceof ArrayBuffer)
          ) {
            throw new Error("Invalid file content");
          }

          const geometry = loader.parse(stlString);
          const material = new THREE.MeshPhysicalMaterial({
            // Convert hex color string to number if provided, otherwise use theme-based default
            color: color
              ? parseInt(color.replace("#", "0x"))
              : resolvedTheme === "dark"
              ? 0xffffff
              : 0x222222,
            metalness: 0.25,
            roughness: 0.5,
            envMapIntensity: 1,
            clearcoat: 0.1,
            clearcoatRoughness: 0.1,
          });
          const mesh = new THREE.Mesh(geometry, material);

          geometry.center();

          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // Increase the scale factor to fill more of the canvas
          const scale = 4.5 / maxDim;
          mesh.scale.set(scale, scale, scale);

          // Position the mesh at the center of the scene
          mesh.position.set(0, 0, 0);

          scene.add(mesh);

          // Adjust camera position based on object size for better framing
          const objectCenter = new THREE.Vector3();
          box.getCenter(objectCenter);

          // Set camera position to better frame the object
          camera.position.set(0, 0, 4);
          camera.lookAt(objectCenter);

          // Update controls target to the center of the object
          controls.target.copy(objectCenter);
          controls.update();
        } catch (error) {
          console.error("Error parsing STL file:", error);
          setError("Error parsing STL file. Please try another file.");
        }
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        setError("Error reading file. Please try again.");
      };

      reader.readAsArrayBuffer(file);

      const animateFrame = () => {
        requestAnimationFrame(animateFrame);
        controls.update();
        renderer.render(scene, camera);
      };
      animateFrame();

      window.addEventListener("resize", handleResize);
    } catch (error) {
      console.error("Error setting up Three.js scene:", error);
      setError("Error setting up 3D viewer. Please try again.");
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current && renderer) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (controls) {
        controls.dispose();
      }
    };
  }, [file, resolvedTheme, animate, size, color]);

  return (
    <div className="flex relative h-full w-full">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}

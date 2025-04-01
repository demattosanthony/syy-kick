"use client";

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Site } from "../types/sites";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface SitesMapProps {
  sites?: Site[];
  isLoading?: boolean;
  onSiteSelect?: (site: Site) => void;
  hoveredSiteId?: string | null;
}

const SitesMap: React.FC<SitesMapProps> = ({
  sites = [],
  onSiteSelect,
  hoveredSiteId,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Keep track of marker references and active popup marker ID
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  // 1. Initialize map once
  useEffect(() => {
    try {
      if (!mapContainer.current || map.current || !mapboxgl.accessToken) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-98.5795, 39.8283],
        zoom: 3,
      });

      // Navigation control
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Switch style when zoom > 15
      map.current.on("zoom", () => {
        if (!map.current) return;
        const zoomLevel = map.current.getZoom();
        if (!map.current || !map.current.isStyleLoaded()) return;

        const styleName = map.current.getStyle()?.name;

        if (zoomLevel > 15 && styleName !== "Mapbox Satellite") {
          map.current.setStyle("mapbox://styles/mapbox/satellite-v9");
        } else if (zoomLevel <= 15 && styleName !== "Mapbox Streets") {
          map.current.setStyle("mapbox://styles/mapbox/streets-v12");
        }
      });

      // Close popups on map click
      map.current.on("click", () => {
        popupRef.current?.remove();
        popupRef.current = null;
        setActiveMarkerId(null);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    // Cleanup
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 2. Create/Update markers when sites or hoveredSiteId change
  useEffect(() => {
    try {
      if (!map.current || !sites.length) return;

      // Remove old markers
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const bounds = new mapboxgl.LngLatBounds();
      let hasMarker = false;

      // Helper to open a popup for a given site
      const openPopupForSite = (site: Site) => {
        if (!site.address?.latitude || !site.address?.longitude) return;
        popupRef.current?.remove(); // remove any open popup

        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: "bottom",
          offset: [0, -10],
          className: "shadcn-card-popup",
        })
          .setLngLat([+site.address.longitude, +site.address.latitude])
          .setDOMContent(document.createElement("div")) // We'll render content in effect #3
          .addTo(map.current!);

        setActiveMarkerId(`site-${site.id}`);
      };

      // Create markers
      sites.forEach((site) => {
        const lat = site.address?.latitude;
        const lng = site.address?.longitude;
        if (lat == null || lng == null) return;

        const color = site.id === hoveredSiteId ? "#ff6f09" : "#000000";
        const marker = new mapboxgl.Marker({ color })
          .setLngLat([+lng, +lat])
          .addTo(map.current!);

        // Marker click
        marker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();
          openPopupForSite(site);
        });

        markersRef.current[site.id] = marker;
        bounds.extend([+lng, +lat]);
        hasMarker = true;
      });

      // Fit bounds
      if (hasMarker && !bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 150, maxZoom: 15 });
      }
    } catch (error) {
      console.error("Error creating markers:", error);
    }
  }, [sites, hoveredSiteId]);

  // 3. Render popup content whenever activeMarkerId changes
  useEffect(() => {
    try {
      if (!activeMarkerId || !popupRef.current) return;

      const siteId = activeMarkerId.replace("site-", "");
      const site = sites.find((s) => s.id === siteId);
      if (!site) return;

      const container = document.querySelector(
        ".shadcn-card-popup .mapboxgl-popup-content"
      );
      if (!container) return;

      // Clear container (in case)
      container.innerHTML = "";

      // Build the actual markup
      const rootDiv = document.createElement("div");
      rootDiv.className =
        "bg-card text-card-foreground rounded-lg border shadow-md w-64";
      rootDiv.innerHTML = `
        <a href="/projects?siteId=${siteId}" class="block cursor-pointer">
          <div class="p-4 pb-2 flex flex-col space-y-1.5">
            <h3 class="text-lg font-semibold">${site.name}</h3>
          </div>
          <div class="p-4 pt-0 pb-2">
            ${
              site.address?.address
                ? `<p class="text-sm text-muted-foreground">${site.address.address}</p>`
                : ""
            }
            ${
              site.address?.city
                ? `<p class="text-sm text-muted-foreground">
                     ${site.address.city}, ${site.address.state || ""} ${
                    site.address.postalCode || ""
                  }
                   </p>`
                : ""
            }
          </div>
        </a>
        <div class="p-4 pt-2 flex justify-between items-center">
          <button id="close-btn-${siteId}" class="px-3 py-1 text-sm border rounded-md shadow-sm hover:bg-accent">
            Close
          </button>
          ${
            onSiteSelect
              ? `<button id="view-btn-${siteId}" class="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90">
                  View Details
                </button>`
              : ""
          }
        </div>
      `;

      container.appendChild(rootDiv);

      // Add events
      const closeBtn = document.getElementById(`close-btn-${siteId}`);
      closeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        popupRef.current = null;
        setActiveMarkerId(null);
      });

      const viewBtn = document.getElementById(`view-btn-${siteId}`);
      if (viewBtn && onSiteSelect) {
        viewBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          onSiteSelect(site);
          popupRef.current?.remove();
          popupRef.current = null;
          setActiveMarkerId(null);
        });
      }
    } catch (error) {
      console.error("Error rendering popup content:", error);
    }
  }, [activeMarkerId, sites, onSiteSelect]);

  if (!mapboxgl.accessToken) return null;

  return (
    <div
      ref={mapContainer}
      className="h-full w-full"
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
    />
  );
};

export default SitesMap;

"use client";

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Site } from "../types/sites";

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface SitesMapProps {
  sites: Site[] | undefined;
  isLoading?: boolean;
  onSiteSelect?: (site: Site) => void;
}

const SitesMap: React.FC<SitesMapProps> = ({ sites = [], onSiteSelect }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize map only once and if token exists
    if (map.current || !mapContainer.current || !mapboxgl.accessToken) return;

    // Create map with default style
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3,
    });

    // Add zoom change listener to switch map styles
    map.current.on("zoom", () => {
      if (!map.current) return;
      const zoomLevel = map.current.getZoom();
      const currentStyle = map.current?.getStyle()?.name;

      // Switch to satellite when zoomed in (zoom level > 15)
      if (zoomLevel > 15 && currentStyle !== "Mapbox Satellite") {
        map.current.setStyle("mapbox://styles/mapbox/satellite-v9");
      }
      // Switch back to streets when zoomed out
      else if (zoomLevel <= 15 && currentStyle !== "Mapbox Streets") {
        map.current.setStyle("mapbox://styles/mapbox/streets-v12");
      }
    });

    // Close popup when clicking on the map
    map.current.on("click", () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
        setActiveMarkerId(null);
      }
    });

    // Clean up on unmount
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add markers when sites data changes
  useEffect(() => {
    if (!map.current || !sites.length) return;

    // Clear existing markers first (if needed)
    document
      .querySelectorAll(".mapboxgl-marker")
      .forEach((marker) => marker.remove());

    // Create bounds to fit markers
    const bounds = new mapboxgl.LngLatBounds();
    let markerAdded = false;

    sites.forEach((site) => {
      const latitude = site.address?.latitude;
      const longitude = site.address?.longitude;

      if (latitude != null && longitude != null) {
        // Create a marker with custom color
        const marker = new mapboxgl.Marker({
          color: "#000000", // Using hex code for black
        })
          .setLngLat([Number(longitude), Number(latitude)])
          .addTo(map.current!);

        // Add click handler
        marker.getElement().addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent map click from closing the popup

          // Remove existing popup if any
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Create popup container
          const popupNode = document.createElement("div");
          popupNode.className = "custom-popup";

          // Open the popup
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor: "bottom",
            offset: [0, -10],
            className: "shadcn-card-popup",
          })
            .setLngLat([Number(longitude), Number(latitude)])
            .setDOMContent(popupNode)
            .addTo(map.current!);

          const markerId = `site-${site.id}`;
          setActiveMarkerId(markerId);

          // Add popup close event
          popupRef.current.on("close", () => {
            setActiveMarkerId(null);
          });
        });

        // Extend bounds
        bounds.extend([Number(longitude), Number(latitude)]);
        markerAdded = true;
      }
    });

    // Fit map to markers
    if (markerAdded && !bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [sites]);

  // Render custom popup content when a marker is active
  useEffect(() => {
    if (!activeMarkerId) return;

    const popupContainer = document.querySelector(".custom-popup");
    if (!popupContainer) return;

    const siteId = activeMarkerId.replace("site-", "");
    const site = sites.find((s) => s.id === siteId);

    if (!site) return;

    // Render our shadcn card in the popup container
    const rootDiv = document.createElement("div");
    rootDiv.className = "shadcn-card-container";
    rootDiv.innerHTML = `
      <div class="bg-card text-card-foreground rounded-lg border shadow-md w-64">
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
              ? `<p class="text-sm text-muted-foreground">${
                  site.address.city
                }, ${site.address.state || ""} ${
                  site.address.postalCode || ""
                }</p>`
              : ""
          }
        </div>
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
      </div>
    `;

    popupContainer.appendChild(rootDiv);

    // Add event listeners to the buttons
    const closeBtn = document.getElementById(`close-btn-${siteId}`);
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      });
    }

    const viewBtn = document.getElementById(`view-btn-${siteId}`);
    if (viewBtn && onSiteSelect) {
      viewBtn.addEventListener("click", () => {
        onSiteSelect(site);
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      });
    }

    return () => {
      // Cleanup
      popupContainer.innerHTML = "";
    };
  }, [activeMarkerId, sites, onSiteSelect]);

  if (!mapboxgl.accessToken) {
    return null;
  }

  return (
    <div
      ref={mapContainer}
      className="h-full w-full"
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
    />
  );
};

export default SitesMap;

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
  hoveredSiteId?: string | null; // Add new prop for hover highlighting
}

const SitesMap: React.FC<SitesMapProps> = ({
  sites = [],
  onSiteSelect,
  hoveredSiteId,
  isLoading,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({}); // Keep track of markers

  const lastHoveredIdRef = useRef<string | null>(null);

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

  // ... existing code ...

  // Add markers when sites data changes
  useEffect(() => {
    if (!map.current || !sites?.length) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {}; // Reset markers reference

    // Create bounds to fit markers
    const bounds = new mapboxgl.LngLatBounds();
    let markerAdded = false;

    sites.forEach((site) => {
      const latitude = site.address?.latitude;
      const longitude = site.address?.longitude;

      if (latitude != null && longitude != null) {
        // Create standard marker with appropriate color based on hover state
        const marker = new mapboxgl.Marker({
          color: site.id === hoveredSiteId ? "#ff6f09" : "#000000",
        })
          .setLngLat([Number(longitude), Number(latitude)])
          .addTo(map.current!);

        // Store marker reference
        markersRef.current[site.id] = marker;

        // Add click handler for popup
        marker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();

          // Remove existing popup
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
  }, [sites, hoveredSiteId]);

  // Remove all other hover-related effects and just keep one clean approach
  useEffect(() => {
    if (!hoveredSiteId && !lastHoveredIdRef.current) return;
    if (Object.keys(markersRef.current).length === 0) return;

    // If previous hovered marker exists, reset its color
    if (
      lastHoveredIdRef.current &&
      markersRef.current[lastHoveredIdRef.current]
    ) {
      const oldMarker = markersRef.current[lastHoveredIdRef.current];
      const lngLat = oldMarker.getLngLat();
      oldMarker.remove();

      // Recreate with default color
      markersRef.current[lastHoveredIdRef.current] = new mapboxgl.Marker({
        color: "#000000",
      })
        .setLngLat(lngLat)
        .addTo(map.current!);

      // Re-add click handler for the new marker
      attachClickHandler(
        markersRef.current[lastHoveredIdRef.current],
        lastHoveredIdRef.current
      );
    }

    // If new hovered marker exists, set its color to orange
    if (hoveredSiteId && markersRef.current[hoveredSiteId]) {
      const newMarker = markersRef.current[hoveredSiteId];
      const lngLat = newMarker.getLngLat();
      newMarker.remove();

      // Recreate with highlight color
      markersRef.current[hoveredSiteId] = new mapboxgl.Marker({
        color: "#ff6f09",
      })
        .setLngLat(lngLat)
        .addTo(map.current!);

      // Re-add click handler for the new marker
      attachClickHandler(markersRef.current[hoveredSiteId], hoveredSiteId);
    }

    // Update reference
    lastHoveredIdRef.current = hoveredSiteId || null;
  }, [hoveredSiteId]);

  // Helper function to attach click handlers to markers
  const attachClickHandler = (marker: mapboxgl.Marker, siteId: string) => {
    marker.getElement().addEventListener("click", (e) => {
      e.stopPropagation();

      // Find the site
      const site = sites.find((s) => s.id === siteId);
      if (!site || !site.address?.latitude || !site.address?.longitude) return;

      // Remove existing popup
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
        .setLngLat([
          Number(site.address.longitude),
          Number(site.address.latitude),
        ])
        .setDOMContent(popupNode)
        .addTo(map.current!);

      const markerId = `site-${siteId}`;
      setActiveMarkerId(markerId);

      // Add popup close event
      popupRef.current.on("close", () => {
        setActiveMarkerId(null);
      });
    });
  };

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

  // Helper function to update markers based on hover state
  const updateHoveredMarker = (hoveredId: string | null | undefined) => {
    Object.entries(markersRef.current).forEach(([siteId, marker]) => {
      // We need to remove and recreate the marker with the new color
      if (marker) {
        const lngLat = marker.getLngLat();

        // Remove old marker
        marker.remove();

        // Create new marker with appropriate color
        const newMarker = new mapboxgl.Marker({
          color: siteId === hoveredId ? "#ff6f09" : "#000000",
        })
          .setLngLat(lngLat)
          .addTo(map.current!);

        // Replace in our reference object
        markersRef.current[siteId] = newMarker;

        // Re-add click handler for popup
        newMarker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();

          // Remove existing popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Create popup container
          const popupNode = document.createElement("div");
          popupNode.className = "custom-popup";

          // Get site coordinates
          const site = sites.find((s) => s.id === siteId);
          if (!site || !site.address?.latitude || !site.address?.longitude)
            return;

          // Open the popup
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor: "bottom",
            offset: [0, -10],
            className: "shadcn-card-popup",
          })
            .setLngLat([
              Number(site.address.longitude),
              Number(site.address.latitude),
            ])
            .setDOMContent(popupNode)
            .addTo(map.current!);

          const markerId = `site-${siteId}`;
          setActiveMarkerId(markerId);

          // Add popup close event
          popupRef.current.on("close", () => {
            setActiveMarkerId(null);
          });
        });
      }
    });
  };

  // Single effect to handle marker hover state
  useEffect(() => {
    if (Object.keys(markersRef.current).length === 0) return;

    updateHoveredMarker(hoveredSiteId);
  }, [hoveredSiteId]);

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

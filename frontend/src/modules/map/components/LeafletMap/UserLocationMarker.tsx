"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import { basePath } from "@/lib/publicConfig";
import { useMapStore } from "@/modules/map/store/mapStore";

// "Você está aqui", like Google Maps: shown while "Localizar" is on; turning it off removes the pin
// and the accuracy circle without moving the map (the store handles the camera).
// Icons: pointhi/leaflet-color-markers (BSD-2-Clause, see public/map/location-marker).
const ICONS = `${basePath}/map/location-marker`;
const LOCATION_COLOR = "#9c2bcb";

const userLocationIcon = L.icon({
  iconUrl: `${ICONS}/marker-icon-violet.png`,
  iconRetinaUrl: `${ICONS}/marker-icon-2x-violet.png`,
  shadowUrl: `${ICONS}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export function UserLocationMarker() {
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const map = useMap();
  const active = useMapStore((state) => state.locationActive);

  useEffect(() => {
    if (active) return;
    markerRef.current?.remove();
    accuracyRef.current?.remove();
    markerRef.current = null;
    accuracyRef.current = null;
  }, [active]);

  useEffect(() => {
    const onLocationFound = (event: L.LocationEvent) => {
      if (markerRef.current) {
        markerRef.current.setLatLng(event.latlng);
      } else {
        // Added directly to the map, independently of the occurrence layers and clusters.
        markerRef.current = L.marker(event.latlng, {
          icon: userLocationIcon,
          alt: "Sua localização",
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(map);
      }

      const radius = Number.isFinite(event.accuracy) && event.accuracy > 0 ? event.accuracy : 0;
      if (accuracyRef.current) {
        accuracyRef.current.setLatLng(event.latlng).setRadius(radius);
      } else {
        accuracyRef.current = L.circle(event.latlng, {
          radius,
          color: LOCATION_COLOR,
          weight: 1,
          opacity: 0.5,
          fillColor: LOCATION_COLOR,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      }
    };

    const cleanup = () => {
      map.off("locationfound", onLocationFound);
      map.off("unload", cleanup);
      markerRef.current?.remove();
      accuracyRef.current?.remove();
      markerRef.current = null;
      accuracyRef.current = null;
    };

    // A failed retry keeps the last known position on the map.
    map.on("locationfound", onLocationFound);
    map.on("unload", cleanup);

    return cleanup;
  }, [map]);

  return null;
}

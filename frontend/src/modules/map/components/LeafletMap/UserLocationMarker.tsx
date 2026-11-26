"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import styles from "./UserLocationMarker.module.css";

const USER_LOCATION_VISIBLE_MS = 5000;
const USER_LOCATION_FADE_MS = 300;

const userLocationIcon = L.divIcon({
  className: styles.marker,
  html: `<svg class="${styles.pin}" viewBox="0 0 24 32" role="img" aria-label="Localização do usuário" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1C6.5 1 2 5.5 2 11c0 7.5 10 20 10 20s10-12.5 10-20C22 5.5 17.5 1 12 1Z" fill="#ea4335" stroke="#fff" stroke-width="1" />
    <circle cx="12" cy="11" r="3.5" fill="#fff" />
  </svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 31],
});

export function UserLocationMarker() {
  const markerRef = useRef<L.Marker | null>(null);
  const map = useMap();

  useEffect(() => {
    let visibleTimeout: ReturnType<typeof setTimeout> | undefined;
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearLifetime = () => {
      clearTimeout(visibleTimeout);
      clearTimeout(fadeTimeout);
      visibleTimeout = undefined;
      fadeTimeout = undefined;
      map.off("movestart", onMoveStart);
      map.off("moveend", startExpiry);
      markerRef.current?.getElement()?.classList.remove(styles.fading);
    };

    const startExpiry = () => {
      map.off("moveend", startExpiry);
      if (!markerRef.current || !map.hasLayer(markerRef.current)) return;

      visibleTimeout = setTimeout(() => {
        visibleTimeout = undefined;
        markerRef.current?.getElement()?.classList.add(styles.fading);
        fadeTimeout = setTimeout(() => {
          fadeTimeout = undefined;
          markerRef.current?.remove();
        }, USER_LOCATION_FADE_MS);
      }, USER_LOCATION_VISIBLE_MS);
    };

    const onMoveStart = () => {
      // flyTo first stops any previous pan; ignore its moveend and await the new flight.
      map.once("moveend", startExpiry);
    };

    const onLocationFound = (event: L.LocationEvent) => {
      clearLifetime();
      if (markerRef.current) {
        markerRef.current.setLatLng(event.latlng).addTo(map);
      } else {
        // Add directly to the map, independently of epidemiological layers.
        markerRef.current = L.marker(event.latlng, {
          icon: userLocationIcon,
          alt: "Localização do usuário",
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(map);
      }

      map.once("movestart", onMoveStart);
    };

    const onLocationError = () => {
      // A failed retry must not leave a previously visible pin on the map forever.
      clearLifetime();
      startExpiry();
    };

    const cleanup = () => {
      clearLifetime();
      map.off("userlocationstart", clearLifetime);
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
      map.off("unload", cleanup);
      markerRef.current?.remove();
      markerRef.current = null;
    };

    map.on("userlocationstart", clearLifetime);
    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);
    map.on("unload", cleanup);

    return cleanup;
  }, [map]);

  return null;
}

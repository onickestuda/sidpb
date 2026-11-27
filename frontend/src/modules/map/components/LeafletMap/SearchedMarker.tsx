"use client";

import { Marker } from "react-leaflet";

import { searchedLocationIcon } from "./map-icons";

interface Props {
  position?: [number, number] | null;
}

/** Pin of the searched place; same icon as the legend (map-icons). */
export function SearchMarker({ position }: Props) {
  if (!position) return null;
  return <Marker position={position} icon={searchedLocationIcon} />;
}

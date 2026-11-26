import L from "leaflet";

import { basePath } from "@/lib/publicConfig";

export const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export const searchedLocationIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// Not yet verified by a human curator (automatic extraction). Icons: pointhi/leaflet-color-markers (BSD-2).
export const uncuratedIcon = new L.Icon({
  iconUrl: `${basePath}/map/markers/marker-icon-grey.png`,
  iconRetinaUrl: `${basePath}/map/markers/marker-icon-2x-grey.png`,
  shadowUrl: `${basePath}/map/markers/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

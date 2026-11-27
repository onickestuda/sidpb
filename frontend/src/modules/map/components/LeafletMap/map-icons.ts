import L from "leaflet";

import { basePath } from "@/lib/publicConfig";

// Local SVG pins (no external CDN, so the map works offline). Colors match the occurrence
// traffic lights: green = curated, red = not curated. The shadow is the Leaflet default.
const MARKERS = `${basePath}/map/markers`;
const pin = (name: string) => new L.Icon({
  iconUrl: `${MARKERS}/marker-${name}.svg`,
  shadowUrl: `${MARKERS}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

/** Occurrence verified by a curator. */
export const defaultIcon = pin("curada");

/** Searched place (the "Pesquisar" box with a place name). */
export const searchedLocationIcon = pin("pesquisa");

/** Not yet verified by a human curator (automatic extraction). */
export const uncuratedIcon = pin("nao-curada");

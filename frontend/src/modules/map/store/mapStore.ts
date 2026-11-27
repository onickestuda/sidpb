"use client";

import type L from "leaflet";
import { create } from "zustand";

import type { Occurrence } from "@/entities/occurrence/occurrence.types";

import {
  MIN_ZOOM,
  MAX_ZOOM,
  SATELLITE_MAX_ZOOM,
} from "../components/LeafletMap/map-zoom";

export type MapView = "street" | "satellite";

export const DEFAULT_CENTER: [number, number] = [-14.235, -51.925];
export const DEFAULT_ZOOM = 4;

const LOCATE_TIMEOUT_MS = 10000;
const LOCATE_FLIGHT = { animate: true, duration: 1.5 } as const;
const UNSUPPORTED_LOCATION = "Seu navegador não permite obter a localização.";
const LOCATION_ERRORS: Record<number, string> = {
  1: "Permissão de localização negada. Autorize o acesso à localização no navegador.",
  2: "Não foi possível obter sua localização agora. Tente novamente.",
  3: "A busca pela sua localização esgotou o tempo. Tente novamente.",
};

// Listeners of the single in-flight geolocation request; detached on success, error or map unload.
let detachLocateRequest: (() => void) | null = null;


interface MapStore {
  map: L.Map | null;

  mapView: MapView;

  currentZoom: number;

  legendVisible: boolean;

  isLocating: boolean;

  /** "Localizar" is on: the user's pin and accuracy circle are shown. */

  locationActive: boolean;
  locationError: string | null;

  selectedOccurrence: Occurrence | null;
  selectedOccurrences: Occurrence[];

  registerMap(map: L.Map): void;

  setCurrentZoom(zoom: number): void;

  zoomIn(): void;
  zoomOut(): void;

  resetMap(): void;

  flyTo(
    center: [number, number],
    zoom?: number
  ): void;

  fitBounds(
    bounds: L.LatLngBoundsExpression
  ): void;

  locateUser(): void;

  toggleMapView(): void;

  toggleLegend(): void;

  setSelectedOccurrence(
    occurrence: Occurrence | null
  ): void;
  selectOccurrences(occurrences: Occurrence[]): void;
  clearOccurrenceSelection(): void;
  reconcileOccurrenceSelection(occurrences: Occurrence[]): void;

  toggleFullscreen(): Promise<void>;
}

export const useMapStore = create<MapStore>((set, get) => ({
  map: null,

  mapView: "street",

  currentZoom: DEFAULT_ZOOM,

  legendVisible: false,

  isLocating: false,

  locationActive: false,
  locationError: null,

  selectedOccurrence: null,
  selectedOccurrences: [],

  registerMap(map) {
    map.setMinZoom(MIN_ZOOM);
    map.setMaxZoom(MAX_ZOOM);

    set({ map });
  },

  setCurrentZoom(zoom) {
    set({
      currentZoom: zoom,
    });
  },

  zoomIn() {
    get().map?.zoomIn();
  },

  zoomOut() {
    get().map?.zoomOut();
  },

  resetMap() {
    get().map?.flyTo(
      DEFAULT_CENTER,
      DEFAULT_ZOOM,
      {
        animate: true,
        duration: 1.2,
      }
    );
  },

  flyTo(center, zoom) {
    const map = get().map;

    if (!map) return;

    map.flyTo(
      center,
      zoom ?? map.getZoom(),
      {
        animate: true,
      }
    );
  },

  fitBounds(bounds) {
    get().map?.fitBounds(bounds, {
      padding: [32, 32],
      animate: true,
    });
  },

  // Toggle. Off -> on: ask the browser for the position and fly to it (zoom limited to the satellite
  // layer, so imagery never runs out). On -> off: only hides the pin and the accuracy circle (drawn by
  // UserLocationMarker), keeping the current zoom and position.
  locateUser() {
    const map = get().map;
    if (!map || get().isLocating) return;
    if (get().locationActive) {
      set({ locationActive: false, locationError: null });
      return;
    }

    const finish = (patch: Partial<MapStore>) => {
      detachLocateRequest?.();
      set({ isLocating: false, ...patch });
    };
    const onFound = (event: L.LocationEvent) => {
      finish({ locationError: null, locationActive: true });
      map.flyTo(event.latlng, SATELLITE_MAX_ZOOM, LOCATE_FLIGHT);
    };
    const onError = (event: { code?: number }) => {
      finish({ locationError: LOCATION_ERRORS[event.code ?? 0] ?? UNSUPPORTED_LOCATION });
    };
    const onUnload = () => {
      map.stopLocate();
      finish({ map: null });
    };

    map.on("locationfound", onFound);
    map.on("locationerror", onError);
    map.on("unload", onUnload);
    detachLocateRequest = () => {
      map.off("locationfound", onFound);
      map.off("locationerror", onError);
      map.off("unload", onUnload);
      detachLocateRequest = null;
    };

    set({ isLocating: true, locationError: null });
    try {
      map.locate({ setView: false, timeout: LOCATE_TIMEOUT_MS });
    } catch {
      finish({ locationError: UNSUPPORTED_LOCATION });
    }
  },

  toggleMapView() {
    set((state) => ({
      mapView:
        state.mapView === "street"
          ? "satellite"
          : "street",
    }));
  },

  toggleLegend() {
    set((state) => ({
      legendVisible: !state.legendVisible,
    }));
  },

  setSelectedOccurrence(
    selectedOccurrence
  ) {
    if (!selectedOccurrence) {
      get().clearOccurrenceSelection();
      return;
    }

    const group = get().selectedOccurrences;
    set({
      selectedOccurrence,
      selectedOccurrences: group.some((item) => item.id === selectedOccurrence.id)
        ? group
        : [selectedOccurrence],
    });
  },

  selectOccurrences(occurrences) {
    const selectedOccurrences = Array.from(
      new Map(occurrences.map((occurrence) => [occurrence.id, occurrence])).values()
    );
    set({
      selectedOccurrences,
      selectedOccurrence: selectedOccurrences.length === 1 ? selectedOccurrences[0] : null,
    });
  },

  clearOccurrenceSelection() {
    set({ selectedOccurrences: [], selectedOccurrence: null });
  },

  reconcileOccurrenceSelection(occurrences) {
    const { selectedOccurrences, selectedOccurrence } = get();
    if (selectedOccurrences.length === 0) return;

    const visibleById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
    const nextGroup = selectedOccurrences
      .map((occurrence) => visibleById.get(occurrence.id))
      .filter((occurrence): occurrence is Occurrence => Boolean(occurrence));
    set({
      selectedOccurrences: nextGroup,
      selectedOccurrence: selectedOccurrence
        ? visibleById.get(selectedOccurrence.id) ?? null
        : null,
    });
  },
  async toggleFullscreen() {
    const map = get().map;
    if (!map) return;

    const mapContainer = map.getContainer();
    const container = mapContainer.closest<HTMLElement>("[data-dashboard-map-layout]") ?? mapContainer;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }

    window.setTimeout(() => {
      map.invalidateSize();
    }, 100);
  },
}));

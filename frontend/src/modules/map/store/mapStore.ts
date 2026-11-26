"use client";

import type L from "leaflet";
import { create } from "zustand";

import type { Occurrence } from "@/entities/occurrence/occurrence.types";

import {
  MIN_ZOOM,
  MAX_ZOOM,
} from "../components/LeafletMap/map-zoom";

export type MapView = "street" | "satellite";

export const DEFAULT_CENTER: [number, number] = [-14.235, -51.925];
export const DEFAULT_ZOOM = 4;


interface MapStore {
  map: L.Map | null;

  mapView: MapView;

  currentZoom: number;

  legendVisible: boolean;

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

  locateUser() {
    get().map?.locate({
      setView: true,
      maxZoom: 10,
    });
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

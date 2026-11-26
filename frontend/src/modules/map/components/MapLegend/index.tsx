"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { basePath } from "@/lib/publicConfig"
import { LegendItem } from "@/modules/map/components/MapLegend/LegendItem"
import { defaultIcon, searchedLocationIcon } from "@/modules/map/components/LeafletMap/map-icons"
import { CLUSTER_COUNT_BANDS } from "@/modules/map/components/LeafletMap/occurrence-cluster"

interface MapLegendProps {
  onClose: () => void
}

function Pin({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static map marker, same asset Leaflet draws
  return <img src={src} alt={alt} width={12} height={20} className="h-5 w-3 shrink-0" />
}

// Each entry mirrors what the map actually draws, so the legend never drifts from the markers.
export function MapLegend({ onClose }: MapLegendProps) {
  return (
    <div className="absolute top-3 right-3 z-[400] w-60 border border-border bg-card p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Legenda</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Fechar legenda">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-2.5">
        <LegendItem marker={<Pin src={defaultIcon.options.iconUrl} alt="" />} label="Ocorrência" />
        <LegendItem
          marker={<span className="size-4 shrink-0 rounded-full border-[3px] border-[#1B5E20] bg-[#1B5E20]/15" />}
          label="Ocorrência selecionada"
        />
        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agrupamentos</p>
        {CLUSTER_COUNT_BANDS.map((band) => (
          <LegendItem
            key={band.className}
            marker={
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: band.outer }}>
                <span className="size-3 rounded-full" style={{ backgroundColor: band.inner }} />
              </span>
            }
            label={band.label}
          />
        ))}
        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marcadores de apoio</p>
        <LegendItem marker={<Pin src={searchedLocationIcon.options.iconUrl} alt="" />} label="Local pesquisado" />
        <LegendItem marker={<Pin src={`${basePath}/map/location-marker/marker-icon-violet.png`} alt="" />} label="Sua localização" />
      </div>
    </div>
  )
}

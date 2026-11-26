"use client"

import { Button } from "@/components/ui/button"
import {
  X,
  ChevronRight,
  ChevronLeft,
  Bug,
  Calendar,
  User,
  Tag,
  AlertCircle,
  Info, // Adicionado ícone que faltava
} from "lucide-react"
import type { Occurrence } from "@/entities/occurrence/occurrence.types"
import { formatOccurrenceDate } from "@/features/occurrences/utils/formatOccurrenceDate"
import { getHostCategoryColor } from "@/features/occurrences/utils/getHostCategoryColor"
import { OccurrenceDetails } from "./OccurrenceDetails"

// Interface corrigida para o Painel Principal
interface OccurrencePanelProps {
  occurrences: Occurrence[];
  isExpanded: boolean;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}

export function OccurrencePanel({
  occurrences,
  isExpanded,
  onClose,
  onExpand,
  onCollapse,
}: OccurrencePanelProps) {
  
  if (!occurrences || occurrences.length === 0) return null;
  const mainLocation = occurrences[0];

  return (
    <div className={`
        absolute top-0 right-0 h-full bg-card border-l border-border shadow-xl z-30
        transition-all duration-300 ease-in-out overflow-hidden
        ${isExpanded ? "w-full md:w-2/3 lg:w-1/2" : "w-80 md:w-96"}
      `}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Ocorrências ({occurrences.length})
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={isExpanded ? onCollapse : onExpand}>
                {isExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col">
            {occurrences.map((occ: Occurrence, index: number) => (
              <div key={occ.id || index} className="border-b border-border last:border-0">
                {isExpanded ? (
                  <ExpandedContent occurrence={occ} index={index} isMultiple={occurrences.length > 1} />
                ) : (
                  <CompactContent occurrence={occ} onExpand={onExpand} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// COMPACT CONTENT - Corrigido Props
function CompactContent({
  occurrence,
  onExpand,
}: {
  occurrence: Occurrence
  onExpand: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={<Bug className="w-4 h-4" />} label="Doença" value={occurrence.disease} />
        <InfoCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Vetor"
          value={<em className="text-xs">{occurrence.vector.split(" ").slice(0, 2).join(" ")}</em>}
        />
        <InfoCard icon={<Calendar className="w-4 h-4" />} label="Data" value={formatOccurrenceDate(occurrence.date)} />
        <InfoCard icon={<User className="w-4 h-4" />} label="Hospedeiro" value={occurrence.host} />
      </div>

      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-muted-foreground" />
        <span className={`text-xs font-medium px-2 py-1 rounded-none ${getHostCategoryColor(occurrence.hostCategory)}`}>
          {occurrence.hostCategory}
        </span>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onExpand}>
        Ver detalhes completos
        <ChevronLeft className="w-4 h-4 ml-2" />
      </Button>
    </div>
  )
}

// Reuse the same complete record in the contextual sidebar and legacy panel.
function ExpandedContent({ occurrence, index, isMultiple }: {
  occurrence: Occurrence; index: number; isMultiple: boolean;
}) {
  return (
    <div className="space-y-4 bg-background p-6">
      {isMultiple && <p className="text-xs font-semibold text-primary">Evento Epidemiológico #{index + 1}</p>}
      <h2 className="text-lg font-semibold">Prontuário da Ocorrência</h2>
      <OccurrenceDetails occurrence={occurrence} />
    </div>
  );
}

// Funções Auxiliares de UI (Sub-componentes)
function InfoCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-none border border-border bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  )
}

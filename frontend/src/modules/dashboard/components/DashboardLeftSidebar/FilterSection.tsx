"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Number of selected options; shown as a badge so filters are visible while collapsed. */
  activeCount?: number;
}

export function FilterSection({
  title,
  children,
  defaultOpen = false,
  activeCount = 0,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      ><span className="text-sm font-medium">{title}</span><span className="flex items-center gap-2">{activeCount > 0 && (
            <span
              aria-label={`${activeCount} filtros ativos`}
              className="min-w-5 bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary-foreground"
            >
              {activeCount}
            </span>
          )}<ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          /></span></button>

      {open && (
        <div id={contentId} className="space-y-1 px-4 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

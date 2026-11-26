"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

// The API re-validates the file signature; here we only give immediate feedback.
export function pdfProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf"))
    return "O arquivo precisa ser um PDF.";
  if (file.size === 0) return "O PDF selecionado está vazio.";
  if (file.size > MAX_PDF_BYTES) return "O PDF deve ter no máximo 20 MB.";
  return null;
}

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface PdfFieldProps {
  value: File | null;
  onChange(file: File | null): void;
  disabled?: boolean;
}

export function PdfField({ value, onChange, disabled }: PdfFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setUrl(null); setPreview(false); if (input.current) input.current.value = ""; return; }
    const next = URL.createObjectURL(value);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [value]);

  function select(file: File | undefined) {
    if (!file) return;
    const problem = pdfProblem(file);
    setError(problem);
    if (problem) { if (input.current) input.current.value = ""; return; }
    onChange(file);
    setPreview(true);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">PDF do artigo *</label>
      <input ref={input} id={inputId} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={disabled}
        onChange={event => select(event.target.files?.[0])} />
      {value ? (
        <div className="flex items-center gap-3 border border-border bg-muted/40 px-3 py-2">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={value.name}>{value.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setPreview(open => !open)}
            aria-expanded={preview}>
            {preview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{preview ? "Ocultar" : "Visualizar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => input.current?.click()}>Trocar</Button>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Remover PDF"
            onClick={() => { setError(null); onChange(null); }}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-1 border border-dashed border-input px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50">
          <Upload className="size-5" aria-hidden />
          <span className="font-medium text-foreground">Escolher PDF</span>
          <span className="text-xs">Somente PDF, até 20 MB.</span>
        </button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {value && preview && url && (
        <iframe src={url} title={`Prévia de ${value.name}`} className="h-[480px] w-full border border-border bg-white" />
      )}
    </div>
  );
}

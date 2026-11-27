"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CurationFilters, SpecialtySelection, SubmissionStatus } from "@/entities/submission/submission.types";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { SubmissionTable } from "@/modules/submissions/components/SubmissionTable";
import { curationService } from "../services/curation.service";
import { EMPTY_SELECTION, SpecialtyDialog } from "./SpecialtyDialog";

export function CurationQueue() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<CurationFilters>({
    status: "PENDING", title: "", year: "", disease: "", from: "", to: "", page: 0, ...EMPTY_SELECTION,
  });

  // The specialty saved in the curator's account is applied once, when it loads.
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ["curation", "specialty", user?.id], queryFn: ({ signal }) => curationService.specialty(signal),
    enabled: Boolean(user), staleTime: Infinity });
  const appliedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !saved.data || appliedFor.current === user.id) return;
    appliedFor.current = user.id;
    setFilters((state) => ({ ...state, ...saved.data, page: 0 }));
  }, [user, saved.data]);
  const saveSpecialty = useMutation({
    mutationFn: (selection: SpecialtySelection) => curationService.saveSpecialty(selection),
    onSuccess: (stored) => {
      queryClient.setQueryData(["curation", "specialty", user?.id], stored);
      setFilters((state) => ({ ...state, ...stored, page: 0 }));
    },
  });

  const query = useQuery({ queryKey: ["curation", "queue", filters], queryFn: ({ signal }) => curationService.list(filters, signal),
    staleTime: 0, refetchOnWindowFocus: true });
  const facets = useQuery({ queryKey: ["curation", "facets", filters.status],
    queryFn: ({ signal }) => curationService.facets(filters.status, signal), staleTime: 30_000 });

  const selection: SpecialtySelection = {
    diseases: filters.diseases ?? [], vectors: filters.vectors ?? [], hosts: filters.hosts ?? [], states: filters.states ?? [],
  };

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setFilters(state => ({ ...state, page: 0,
      title: String(values.get("title") ?? "").trim(), year: String(values.get("year") ?? ""),
      from: String(values.get("from") ?? ""), to: String(values.get("to") ?? ""),
    }));
  }

  return <Card>
    <CardHeader><CardTitle><h2>Fila de artigos</h2></CardTitle></CardHeader>
    <CardContent className="space-y-6">
      <Tabs value={filters.status} onValueChange={value => setFilters(state => ({ ...state, status: value as SubmissionStatus, page: 0 }))}>
        <TabsList aria-label="Status da curadoria">
          <TabsTrigger value="PENDING">Pendentes</TabsTrigger>
          <TabsTrigger value="APPROVED">Aprovados</TabsTrigger>
          <TabsTrigger value="REJECTED">Reprovados</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={query.isFetching} onClick={() => { void query.refetch(); void facets.refetch(); }}>Atualizar fila</Button>
        <SpecialtyDialog facets={facets.data} selection={selection} saving={saveSpecialty.isPending}
          onApply={(next) => saveSpecialty.mutateAsync(next)} />
      </div>
      <form onSubmit={search} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="curation-search">Buscar artigo</Label><Input id="curation-search" name="title" maxLength={500} placeholder="Título do artigo..." /></div>
        <div className="space-y-2"><Label htmlFor="curation-year">Ano do artigo</Label><Input id="curation-year" name="year" type="number" min={1500} max={2100} /></div>
        <div className="space-y-2"><Label htmlFor="curation-from">Enviado a partir de</Label><Input id="curation-from" name="from" type="date" /></div>
        <div className="space-y-2"><Label htmlFor="curation-to">Enviado até</Label><Input id="curation-to" name="to" type="date" /></div>
        <Button type="submit" className="self-end sm:col-span-2 lg:col-span-1 lg:col-start-4">Buscar</Button>
      </form>
      {query.isPending && <p role="status">Carregando fila...</p>}
      {query.isError && <div role="alert" className="space-y-3"><p>Não foi possível carregar a fila. Confira os filtros e a conexão.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
      {query.data && <SubmissionTable data={query.data} mode="curator" isFetching={query.isFetching} onPage={page => setFilters(state => ({ ...state, page }))} />}
    </CardContent>
  </Card>;
}

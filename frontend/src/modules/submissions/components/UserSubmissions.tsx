"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { submissionsService } from "../services/submissions.service";
import { SubmissionForm } from "./SubmissionForm";
import { SubmissionTable } from "./SubmissionTable";

export function UserSubmissions() {
  const { user } = useAuth();
  const [tab, setTab] = useState("submeter");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["submissions", user?.id, page],
    queryFn: ({ signal }) => submissionsService.list(user!.id, page, signal), enabled: Boolean(user),
    staleTime: 0, refetchOnWindowFocus: true,
  });
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList aria-label="Submissões de artigos" className="w-full sm:w-fit">
        <TabsTrigger value="submeter">Submeter artigo</TabsTrigger>
        <TabsTrigger value="minhas-submissoes">Minhas submissões</TabsTrigger>
      </TabsList>
      {/* Mantém o preenchimento e o PDF selecionado ao alternar entre as abas. */}
      <TabsContent value="submeter" forceMount hidden={tab !== "submeter"}>
        <SubmissionForm onCreated={() => setPage(0)} />
      </TabsContent>
      <TabsContent value="minhas-submissoes" forceMount hidden={tab !== "minhas-submissoes"}>
        <Card>
          <CardHeader><CardTitle><h2>Minhas submissões</h2></CardTitle></CardHeader>
          <CardContent>
            {query.isPending && <p role="status">Carregando submissões...</p>}
            {query.isError && <div role="alert" className="space-y-3"><p>Não foi possível carregar suas submissões.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
            {query.data && <SubmissionTable data={query.data} mode="user" onPage={setPage} isFetching={query.isFetching} />}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

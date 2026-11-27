"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProfileLayout } from "./ProfileLayout";

type Profile = "USER" | "CURATOR" | "ADMIN";
const labels: Record<Profile,string> = { USER: "Usuário comum", CURATOR: "Curador", ADMIN: "Administrador" };
const capabilities: Record<Profile,string> = {
  USER: "Pode submeter artigos e acompanhar suas submissões.",
  CURATOR: "Pode submeter artigos, avaliar submissões e consultar avaliações.",
  ADMIN: "Pode avaliar submissões, gerenciar contas e promover outros administradores.",
};
interface User { id: string; firstName: string; lastName: string; email: string; enabled: boolean; emailVerified: boolean; profile: Profile; createdTimestamp: number | null; self: boolean; reviews: number | null; }
interface UserPage { items: User[]; nextFirst: number | null; }
interface Details { user: User; authenticationMethods: string[]; }
interface AuditState { profile: Profile; enabled: boolean; firstName: string; lastName: string; email: string; }
interface Audit { id: number; actor_sub: string; actor_name: string; target_sub: string; target_name: string; operation: string; result: string; created_at: string; before_state: AuditState; after_state: AuditState | null; }
const name = (user: User) => `${user.firstName} ${user.lastName}`.trim() || user.email;
const date = (value: string | number) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const selectClass = "h-10 w-full border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function History({ target = "", revision = 0 }: { target?: string; revision?: number }) {
  const [rows,setRows]=useState<Audit[]>([]),[cursors,setCursors]=useState([0]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const before=cursors[cursors.length-1];
  useEffect(() => {
    const controller=new AbortController(); setLoading(true); setError("");
    apiRequest<Audit[]>("/api/admin/users/history",{params:{target,before,max:20},signal:controller.signal})
      .then(setRows).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[target,before,revision]);
  const outcomes: Record<string,string>={SUCCESS:"Concluída",FAILED:"Não concluída",PARTIAL:"Alteração parcial — solicite revisão",UNKNOWN:"Resultado não confirmado — solicite revisão",PENDING:"Aguardando confirmação — pode exigir revisão"};
  return <section className="space-y-4" aria-label="Histórico administrativo">
    {loading ? <p role="status">Carregando histórico...</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p className="text-muted-foreground">Nenhuma alteração administrativa registrada nesta página.</p> :
      <ol className="space-y-3">{rows.map(row => <li key={row.id} className="space-y-2 border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{row.operation === "PROFILE_CHANGE" ? "Alteração de perfil" : "Alteração de conta"}</strong><time dateTime={row.created_at}>{date(row.created_at)}</time></div>
        <p>{row.actor_name} → {row.target_name}</p>
        <p>{outcomes[row.result] || row.result}</p>
        <p>Antes: {labels[row.before_state.profile]} · {row.before_state.enabled ? "Ativa" : "Desativada"}</p>
        <p>Depois: {row.after_state ? `${labels[row.after_state.profile]} · ${row.after_state.enabled ? "Ativa" : "Desativada"}` : "Ainda não confirmado"}</p>
        {row.after_state && (row.before_state.firstName !== row.after_state.firstName || row.before_state.lastName !== row.after_state.lastName || row.before_state.email !== row.after_state.email) && <div className="break-all text-muted-foreground"><p>Dados anteriores: {row.before_state.firstName} {row.before_state.lastName} · {row.before_state.email}</p><p>Dados posteriores: {row.after_state.firstName} {row.after_state.lastName} · {row.after_state.email}</p></div>}
        <details><summary className="cursor-pointer text-muted-foreground">Identificadores do registro</summary><p className="break-all">Responsável: {row.actor_sub}<br />Usuário: {row.target_sub}</p></details>
      </li>)}</ol>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={loading || cursors.length===1} onClick={() => setCursors(c => c.slice(0,-1))}>Histórico anterior</Button><Button variant="outline" disabled={loading || !!error || rows.length<20} onClick={() => setCursors(c => [...c,rows[rows.length-1].id])}>Histórico seguinte</Button></div>
  </section>;
}

function UserDetails({ id, close, changed }: { id: string; close: () => void; changed: () => void }) {
  const [details,setDetails]=useState<Details|null>(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const [profile,setProfile]=useState<Profile>("USER"),[pending,setPending]=useState<"profile"|"status"|null>(null),[confirmed,setConfirmed]=useState(false);
  useEffect(() => {
    const controller=new AbortController();
    apiRequest<Details>(`/api/admin/users/${id}`,{signal:controller.signal}).then(value => {setDetails(value);setProfile(value.user.profile);})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  },[id,revision]);
  const user=details?.user;
  async function save() {
    if (!user || !pending || !confirmed) return;
    setBusy(true);setError("");setMessage("");
    try {
      await apiRequest(`/api/admin/users/${id}/${pending === "profile" ? "roles" : "status"}`,{method:"PUT",body:pending === "profile" ? {profile,confirmed:true} : {enabled:!user.enabled,confirmed:true}});
      setMessage("Alteração confirmada. As sessões anteriores foram encerradas.");
      setPending(null);setConfirmed(false);setRevision(v=>v+1);changed();
    } catch(e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      // Always refresh after uncertain remote outcomes, never imply that nothing changed.
      setPending(null);setConfirmed(false);setRevision(v=>v+1);changed();
    } finally {setBusy(false);}
  }
  return <Dialog open onOpenChange={open => {if (!open && !busy) close();}}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
    <DialogHeader><DialogTitle>Detalhes do usuário</DialogTitle><DialogDescription>Consulte a conta, ajuste o perfil de acesso e acompanhe as alterações.</DialogDescription></DialogHeader>
    {error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
    {!details ? !error && <p role="status">Carregando conta...</p> : user && <>
      <div className="space-y-2 break-words"><h2 className="text-lg font-semibold">{name(user)} {user.self && <span className="text-sm font-normal">(você)</span>}</h2><p>{user.email}</p>
        <p>{labels[user.profile]} · {user.enabled ? "Conta ativa" : "Conta desativada"}</p>
        <p className="text-sm">Acesso: {details.authenticationMethods.join(", ") || "Nenhum método disponível para exibição"}</p>
        <p className="text-sm">Cadastro: {user.createdTimestamp ? date(user.createdTimestamp) : "Data não disponível"}</p>
      </div>
      <section className="space-y-3 border-y py-4" aria-label="Alterar acesso">
        <label className="block text-sm font-medium">Perfil de acesso<select className={selectClass} value={profile} disabled={busy || user.self || !!pending} onChange={e=>setProfile(e.target.value as Profile)}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <p className="text-sm text-muted-foreground">{capabilities[profile]}</p>
        {user.self && <p className="text-sm">Para alterar seu acesso, solicite outro administrador. Você não pode desativar sua própria conta.</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={busy || user.self || profile===user.profile || !!pending} onClick={()=>{setPending("profile");setConfirmed(false);}}>Revisar alteração de perfil</Button><Button variant="outline" disabled={busy || user.self || !!pending} onClick={()=>{setPending("status");setConfirmed(false);}}>{user.enabled ? "Desativar conta" : "Ativar conta"}</Button></div>
        {pending && <div className="space-y-3 border bg-muted/40 p-4" role="region" aria-label="Confirmar alteração">
          <h3 className="font-semibold">Confirme a alteração de {name(user)}</h3>
          {pending === "profile" ? <><p>{labels[user.profile]} → {labels[profile]}</p><p className="text-sm">Acesso atual: {capabilities[user.profile]}</p><p className="text-sm">Novo acesso: {capabilities[profile]}</p></> : <p>{user.enabled ? "A conta perderá o acesso ao sistema até ser reativada." : "A conta poderá entrar novamente com seu perfil atual."}</p>}
          <p className="text-sm">As sessões anteriores serão encerradas. Submissões e avaliações serão preservadas.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />Entendo as consequências e confirmo esta alteração.</label>
          <div className="flex flex-wrap gap-2"><Button disabled={busy || !confirmed} onClick={()=>void save()}>{busy ? "Salvando..." : "Confirmar alteração"}</Button><Button variant="outline" disabled={busy} onClick={()=>setPending(null)}>Cancelar</Button></div>
        </div>}
      </section>
      <h3 className="font-semibold">Histórico desta conta</h3><History key={revision} target={id} revision={revision} />
    </>}
  </DialogContent></Dialog>;
}

function UserList({ team=false }: { team?: boolean }) {
  const [data,setData]=useState<UserPage>({items:[],nextFirst:null}),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[profile,setProfile]=useState(""),[status,setStatus]=useState("");
  const [cursors,setCursors]=useState([0]),[revision,setRevision]=useState(0),[selected,setSelected]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const first=cursors[cursors.length-1];
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    apiRequest<UserPage>("/api/admin/users",{params:{first,max:20,search:query,profile,enabled:status,team},signal:controller.signal,timeoutMs:60000})
      .then(value=>{if (!Array.isArray(value?.items)) throw new Error("Não foi possível carregar a administração. Tente novamente mais tarde.");setData(value);}).catch(e=>{if (!controller.signal.aborted) setError(e.message);}).finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[first,query,profile,status,revision,team]);
  return <div className="space-y-5">
    {team && <div className="flex flex-wrap items-center justify-between gap-3 border bg-card p-4"><p>Curadores e administradores podem avaliar submissões. As contagens mostram avaliações registradas no SIDPB.</p><Button asChild variant="outline"><Link href="/curador">Abrir curadoria</Link></Button></div>}
    <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e=>{e.preventDefault();setCursors([0]);setQuery(search);setRevision(v=>v+1);}}>
      <label className="text-sm font-medium">Nome ou e-mail<Input placeholder="Pesquisar pessoas" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)} /></label>
      <label className="text-sm font-medium">Perfil<select className={selectClass} value={profile} onChange={e=>{setProfile(e.target.value);setCursors([0]);}}><option value="">Todos os perfis</option>{Object.entries(labels).filter(([key])=>!team || key!=="USER").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Status<select className={selectClass} value={status} onChange={e=>{setStatus(e.target.value);setCursors([0]);}}><option value="">Todos os status</option><option value="true">Ativa</option><option value="false">Desativada</option></select></label>
      <Button type="submit" disabled={loading}>Buscar</Button>
    </form>
    {loading ? <p role="status">Carregando usuários...</p> : error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</Button></div> : !data.items.length ? <p className="border p-6 text-muted-foreground">Nenhum usuário encontrado nesta página.{data.nextFirst !== null && " Continue na próxima página para pesquisar mais contas."}</p> :
      <div className="overflow-x-auto border focus-visible:outline-2 focus-visible:outline-ring" role="region" aria-label={team ? "Tabela da equipe de curadoria" : "Tabela de usu?rios"} tabIndex={0}><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">{team ? "Equipe de curadoria" : "Usuários cadastrados"}</caption><thead className="bg-muted"><tr>{["Nome","E-mail","Perfil","Status",...(team ? ["Avaliações"] : []),"Ações"].map(label=><th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.items.map(user=><tr key={user.id} className="border-t"><td className="p-3 font-medium">{name(user)}{user.self && " (você)"}</td><td className="break-all p-3">{user.email}</td><td className="p-3">{labels[user.profile]}</td><td className="p-3"><span className={user.enabled ? "text-primary" : "text-muted-foreground"}>{user.enabled ? "Ativa" : "Desativada"}</span></td>{team && <td className="p-3">{user.reviews ?? "Não disponível"}</td>}<td className="p-3"><Button variant="outline" size="sm" aria-label={`Ver detalhes de ${name(user)}`} onClick={()=>setSelected(user.id)}>Ver detalhes</Button></td></tr>)}</tbody></table></div>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={loading || cursors.length===1} onClick={()=>setCursors(c=>c.slice(0,-1))}>Anterior</Button><span className="text-sm">Página {cursors.length}</span><Button variant="outline" disabled={loading || !!error || data.nextFirst===null} onClick={()=>setCursors(c=>[...c,data.nextFirst!])}>Próxima</Button></div>
    {selected && <UserDetails key={selected} id={selected} close={()=>setSelected(null)} changed={()=>setRevision(v=>v+1)} />}
  </div>;
}
export function AdminUsers() {
  return <ProfileLayout role="ADMIN" title="Usuários e permissões">
    <Tabs defaultValue="users"><TabsList aria-label="Administração de usuários"><TabsTrigger value="users">Usuários</TabsTrigger><TabsTrigger value="curation">Curadoria</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList><TabsContent value="users" className="pt-4"><UserList /></TabsContent><TabsContent value="curation" className="pt-4"><UserList team /></TabsContent><TabsContent value="history" className="pt-4"><History /></TabsContent></Tabs>
  </ProfileLayout>;
}

import { requireRole } from "@/server/auth/guard";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole("USER"); return children;
}

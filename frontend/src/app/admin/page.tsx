import { basePath } from "@/lib/publicConfig";
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect(`${basePath}/admin/usuarios/`);
}

import { redirect } from "next/navigation";

// redirect() already prefixes the configured basePath.
export default function AdminPage() {
  redirect("/admin/usuarios/");
}

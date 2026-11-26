import { ProfileLayout } from "@/modules/auth/components/ProfileLayout";
import { UserSubmissions } from "@/modules/submissions/components/UserSubmissions";

export default function UsuarioPage() {
  return <ProfileLayout role="USER" title="Submissões de artigos"><UserSubmissions /></ProfileLayout>;
}

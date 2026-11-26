import { notFound } from "next/navigation";
import { ProfileLayout } from "@/modules/auth/components/ProfileLayout";
import { UserSubmissionDetail } from "@/modules/submissions/components/UserSubmissionDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647) notFound();
  return <ProfileLayout role="USER" title="Minha submissão"><UserSubmissionDetail id={Number(id)} /></ProfileLayout>;
}

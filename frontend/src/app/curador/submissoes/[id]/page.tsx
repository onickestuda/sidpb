import { notFound } from "next/navigation";
import { ProfileLayout } from "@/modules/auth/components/ProfileLayout";
import { CurationReview } from "@/modules/curation/components/CurationReview";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647) notFound();
  return <ProfileLayout role="CURATOR" title="Revisão do artigo"><CurationReview id={Number(id)} /></ProfileLayout>;
}

import { ProfileLayout } from "@/modules/auth/components/ProfileLayout";
import { CurationQueue } from "@/modules/curation/components/CurationQueue";

export default function CuradorPage() {
  return <ProfileLayout role="CURATOR" title="Curadoria"><CurationQueue /></ProfileLayout>;
}

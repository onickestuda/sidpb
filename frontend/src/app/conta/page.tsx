"use client";

import { AccountSettings } from "@/modules/auth/components/AccountSettings";
import { ProfileLayout } from "@/modules/auth/components/ProfileLayout";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export default function ContaPage() {
  const { user } = useAuth();

  return (
    <ProfileLayout role={user?.role ?? "USER"} title="Minha conta">
      {user && <AccountSettings key={user.id} user={user} />}
    </ProfileLayout>
  );
}

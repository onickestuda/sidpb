import { LoginWallCard } from "./LoginWallCard";
import { basePath } from "@/lib/publicConfig";
import { LoginWallMapBackground } from "./LoginWallMapBackground";

export function LoginWallPage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <link rel="stylesheet" href={`${basePath}/auth/prelogin.css`} />
      <LoginWallMapBackground />

      <section className="relative z-20 flex min-h-svh items-center justify-center px-4 py-8 sm:px-6">
        <LoginWallCard />
      </section>
    </main>
  );
}

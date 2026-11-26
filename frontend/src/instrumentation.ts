export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSessionMaintenance } = await import("./server/auth/maintenance");
    startSessionMaintenance();
  }
}

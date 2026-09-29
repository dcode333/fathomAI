import { IntegrationsClient } from "@/components/integrations/integrations-client";
import { getGoogleConnectionStatus } from "@/lib/google/actions";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = await getGoogleConnectionStatus();

  return (
    <IntegrationsClient
      configured={status.configured}
      connected={status.connected}
      email={status.email}
      hasMeetScopes={status.hasMeetScopes}
      hasDriveMeetScope={status.hasDriveMeetScope}
      flash={params.connected ? "connected" : null}
      error={params.error ?? null}
    />
  );
}

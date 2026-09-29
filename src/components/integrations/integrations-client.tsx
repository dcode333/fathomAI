"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { disconnectGoogle } from "@/lib/google/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IntegrationsClientProps = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  hasMeetScopes: boolean;
  hasDriveMeetScope?: boolean;
  flash?: string | null;
  error?: string | null;
};

export function IntegrationsClient({
  configured,
  connected,
  email,
  hasMeetScopes,
  hasDriveMeetScope = false,
  flash,
  error,
}: IntegrationsClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDisconnect() {
    startTransition(async () => {
      const result = await disconnectGoogle();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Google disconnected");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect Google to create Meet links and fetch post-call transcripts
          and recordings.
          Demo Meeting always stays available.
        </p>
      </div>

      {flash === "connected" ? (
        <div className="rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm">
          Google connected successfully.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error === "google_not_configured"
            ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the server."
            : decodeURIComponent(error)}
        </div>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Google Meet</CardTitle>
          <CardDescription>
            Create a Meet → turn on Transcript / Take notes → end call → fetch
            transcript via Meet API → AI analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Setup required</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Create an OAuth Web client in Google Cloud Console</li>
                <li>
                  Redirect URI:{" "}
                  <code className="text-xs">
                    http://localhost:3000/api/google/callback
                  </code>
                </li>
                <li>
                  Enable <strong>Google Calendar API</strong> and{" "}
                  <strong>Google Meet API</strong>
                </li>
                <li>
                  Add client id/secret +{" "}
                  <code className="text-xs">NEXT_PUBLIC_APP_URL</code> to{" "}
                  <code className="text-xs">.env.local</code>
                </li>
                <li>Restart the dev server</li>
              </ol>
            </div>
          ) : connected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  Connected{email ? ` as ${email}` : ""}
                </span>
                <Button
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unplug className="size-4" />
                  )}
                  Disconnect
                </Button>
              </div>

              {!hasMeetScopes || !hasDriveMeetScope ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium text-foreground">
                    Reconnect required for Meet recordings
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Accept the updated Google permissions (Meet + Drive Meet
                    files). Also enable <strong>Google Drive API</strong> in
                    your Google Cloud project if downloads still fail.
                  </p>
                  <a
                    href="/api/google/connect"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "mt-3 inline-flex gap-2"
                    )}
                  >
                    <RefreshCw className="size-3.5" />
                    Reconnect Google
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Meet + Drive scopes are granted. After a call with Recording
                  and Transcript on, keep the meeting page open — we import
                  automatically when the Meet ends.
                </p>
              )}
            </div>
          ) : (
            <a
              href="/api/google/connect"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Connect Google
            </a>
          )}
        </CardContent>
      </Card>

      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Back to dashboard
      </Link>
    </div>
  );
}

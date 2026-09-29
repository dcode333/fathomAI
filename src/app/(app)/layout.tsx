import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <Suspense fallback={<div className="h-16 border-b border-border/70" />}>
        <AppHeader userName={profile?.full_name} userEmail={user.email} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

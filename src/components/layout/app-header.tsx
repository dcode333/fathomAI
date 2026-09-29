"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogOut, Search, Settings, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  userName?: string | null;
  userEmail?: string | null;
  showSearch?: boolean;
};

export function AppHeader({
  userName,
  userEmail,
  showSearch = true,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const initials =
    userName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    userEmail?.[0]?.toUpperCase() ||
    "U";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Sparkles className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Fathom AI
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/dashboard"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              pathname.startsWith("/dashboard") || pathname.startsWith("/meetings")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Meetings
          </Link>
          <Link
            href="/settings/integrations"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              pathname.startsWith("/settings")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Integrations
          </Link>
        </nav>

        {showSearch ? (
          <form
            onSubmit={onSearch}
            className="relative ml-auto hidden max-w-sm flex-1 sm:block"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, transcripts, actions…"
              className="h-9 bg-card/80 pl-9"
              aria-label="Search meetings"
            />
          </form>
        ) : (
          <div className="ml-auto" />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User menu"
          >
            <Avatar className="size-8 ring-1 ring-border">
              <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {userName || "Account"}
                </span>
                {userEmail ? (
                  <span className="text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings/integrations")}
            >
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

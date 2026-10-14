import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME } from "@/lib/meetings/constants";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.18)_0%,_transparent_55%)]"
      />
      <div className="relative mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
        <div>
          <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
          <p className="text-sm text-muted-foreground">
            AI meeting intelligence
          </p>
        </div>
      </div>
      <div className="relative w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}

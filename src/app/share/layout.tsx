export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}

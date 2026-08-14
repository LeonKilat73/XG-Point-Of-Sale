export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-outline-variant/60 bg-surface-container-low p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export default async function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center flex-col pt-16 relative">
      {children}
    </div>
  );
}

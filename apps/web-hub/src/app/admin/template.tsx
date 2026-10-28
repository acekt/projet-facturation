export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full animate-page-enter">
      {children}
    </div>
  );
}

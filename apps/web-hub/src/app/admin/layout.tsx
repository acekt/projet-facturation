import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";
import { ToastProvider } from "@/components/admin/toast-context";
import { AdminShell } from "@/components/admin/admin-shell";

export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const session = await requireSuperadmin();

  return (
    <ToastProvider>
      <AdminShell
        user={{
          email: session.user.email || "",
          fullName: session.profile.fullName,
          aalLevel: session.aal?.currentLevel?.toUpperCase() || "AAL2",
        }}
        logoutAction={logout}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}

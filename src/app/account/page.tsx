import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountForm } from "@/components/auth/account-form";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted">Manage your sign-in username and password.</p>
      </div>
      <AccountForm username={user.username} />
    </div>
  );
}

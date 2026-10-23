import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const instant = false;

export default async function MfaRootPage() {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();

  const totpFactors = factorsData?.totp || [];
  const verifiedFactors = totpFactors.filter((f) => f.status === "verified");

  if (verifiedFactors.length > 0) {
    redirect("/mfa/verify");
  } else {
    redirect("/mfa/enroll");
  }
}

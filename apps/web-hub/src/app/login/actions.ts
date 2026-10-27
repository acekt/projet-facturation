"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

function translateAuthError(errorMessage?: string): string {
  if (!errorMessage) return "Une erreur est survenue lors de l'authentification.";
  const lower = errorMessage.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Identifiants invalides : adresse email ou mot de passe incorrect.";
  }
  if (lower.includes("email not confirmed")) {
    return "Adresse email non confirmée. Veuillez vérifier votre boîte de réception.";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.";
  }
  if (lower.includes("user not found")) {
    return "Aucun compte Superadmin n'est associé à cette adresse.";
  }
  return errorMessage;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string || "").trim();
  const password = (formData.get("password") as string || "");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const translated = translateAuthError(error.message);
    return redirect("/login?message=" + encodeURIComponent(translated));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

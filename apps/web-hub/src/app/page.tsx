import { redirect } from "next/navigation";
import { connection } from "next/server";

export const instant = false;

export default async function RootHomePage() {
  await connection();
  redirect("/admin");
}

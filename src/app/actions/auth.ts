"use server";

import { cookies } from "next/headers";
import { signUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function switchUser(userId: number) {
  const token = await signUserId(userId);
  const cookieStore = await cookies();
  cookieStore.set("authToken", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}
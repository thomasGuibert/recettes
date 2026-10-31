"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/lib/db";

function lines(v: FormDataEntryValue | null) {
  return String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function int(v: FormDataEntryValue | null) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parse(form: FormData): RecipeInput {
  const title = String(form.get("title") ?? "").trim();
  if (!title) throw new Error("Le titre est obligatoire.");
  const imageUrl = String(form.get("imageUrl") ?? "").trim();
  return {
    title,
    description: String(form.get("description") ?? "").trim(),
    servings: int(form.get("servings")),
    prepMinutes: int(form.get("prepMinutes")),
    cookMinutes: int(form.get("cookMinutes")),
    ingredients: lines(form.get("ingredients")),
    steps: lines(form.get("steps")),
    tags: [
      ...new Set(
        String(form.get("tags") ?? "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    imageUrl: /^https?:\/\//.test(imageUrl) ? imageUrl : null,
  };
}

export async function createRecipeAction(form: FormData) {
  const id = await createRecipe(parse(form));
  revalidatePath("/");
  redirect(`/recettes/${id}`);
}

export async function updateRecipeAction(id: number, form: FormData) {
  await updateRecipe(id, parse(form));
  revalidatePath("/");
  revalidatePath(`/recettes/${id}`);
  redirect(`/recettes/${id}`);
}

export async function deleteRecipeAction(id: number) {
  await deleteRecipe(id);
  revalidatePath("/");
  redirect("/");
}

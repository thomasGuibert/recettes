import RecipeForm from "@/components/RecipeForm";
import { createRecipeAction } from "@/app/actions";
import SetupNotice from "@/components/SetupNotice";
import { isDbConfigured } from "@/lib/db";
import { isExtractionConfigured } from "@/lib/extract";

export const dynamic = "force-dynamic";

export default function NewRecipe() {
  if (!isDbConfigured()) return <SetupNotice />;
  return (
    <>
      <h1>Nouvelle recette</h1>
      <RecipeForm action={createRecipeAction} cancelHref="/" photoImport={isExtractionConfigured() ? "ai" : "ocr"} />
    </>
  );
}

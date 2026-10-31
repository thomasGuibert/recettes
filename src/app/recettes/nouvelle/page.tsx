import RecipeForm from "@/components/RecipeForm";
import { createRecipeAction } from "@/app/actions";

export default function NewRecipe() {
  return (
    <>
      <h1>Nouvelle recette</h1>
      <RecipeForm action={createRecipeAction} cancelHref="/" />
    </>
  );
}

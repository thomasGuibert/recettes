import { notFound } from "next/navigation";
import RecipeForm from "@/components/RecipeForm";
import { getRecipe } from "@/lib/db";
import { updateRecipeAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function EditRecipe({ params }: PageProps<"/recettes/[id]/modifier">) {
  const id = Number((await params).id);
  const recipe = Number.isInteger(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();

  return (
    <>
      <h1>Modifier « {recipe.title} »</h1>
      <RecipeForm action={updateRecipeAction.bind(null, id)} recipe={recipe} cancelHref={`/recettes/${id}`} />
    </>
  );
}

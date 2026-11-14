import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipe, isDbConfigured } from "@/lib/db";
import SetupNotice from "@/components/SetupNotice";
import { deleteRecipeAction } from "@/app/actions";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: PageProps<"/recettes/[id]">) {
  if (!isDbConfigured()) return <SetupNotice />;
  const id = Number((await params).id);
  const recipe = Number.isInteger(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();

  return (
    <article className="recipe">
      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.imageUrl} alt="" className="hero" />
      )}
      <h1>{recipe.title}</h1>
      {recipe.description && <p className="lead">{recipe.description}</p>}
      <p className="meta">
        {recipe.servings != null && <span>🍽 {recipe.servings} personnes</span>}
        {recipe.prepMinutes != null && <span>🔪 Préparation {recipe.prepMinutes} min</span>}
        {recipe.cookMinutes != null && <span>🔥 Cuisson {recipe.cookMinutes} min</span>}
      </p>
      {recipe.tags.length > 0 && (
        <nav className="tags">
          {recipe.tags.map((t) => (
            <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="tag">
              {t}
            </Link>
          ))}
        </nav>
      )}
      <div className="columns">
        <section>
          <h2>Ingrédients</h2>
          <ul>
            {recipe.ingredients.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Étapes</h2>
          <ol>
            {recipe.steps.map((s, n) => (
              <li key={n}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
      <div className="actions">
        <Link href={`/recettes/${recipe.id}/modifier`} className="btn">
          Modifier
        </Link>
        <DeleteButton action={deleteRecipeAction.bind(null, recipe.id)} />
      </div>
    </article>
  );
}

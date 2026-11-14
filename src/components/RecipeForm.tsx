import Link from "next/link";
import type { Recipe } from "@/lib/db";
import PhotoImport from "@/components/PhotoImport";

export default function RecipeForm({
  action,
  recipe,
  cancelHref,
  photoImport = false,
}: {
  action: (form: FormData) => Promise<void>;
  recipe?: Recipe;
  cancelHref: string;
  photoImport?: boolean;
}) {
  return (
    <form action={action} className="form">
      {photoImport && <PhotoImport />}
      <label>
        Titre *
        <input name="title" required defaultValue={recipe?.title} placeholder="Tarte aux pommes" />
      </label>
      <label>
        Description
        <textarea name="description" rows={2} defaultValue={recipe?.description} />
      </label>
      <div className="row">
        <label>
          Portions
          <input name="servings" type="number" min={0} defaultValue={recipe?.servings ?? ""} />
        </label>
        <label>
          Préparation (min)
          <input name="prepMinutes" type="number" min={0} defaultValue={recipe?.prepMinutes ?? ""} />
        </label>
        <label>
          Cuisson (min)
          <input name="cookMinutes" type="number" min={0} defaultValue={recipe?.cookMinutes ?? ""} />
        </label>
      </div>
      <label>
        Ingrédients (un par ligne)
        <textarea
          name="ingredients"
          rows={6}
          defaultValue={recipe?.ingredients.join("\n")}
          placeholder={"4 pommes\n200 g de farine\n100 g de beurre"}
        />
      </label>
      <label>
        Étapes (une par ligne)
        <textarea name="steps" rows={8} defaultValue={recipe?.steps.join("\n")} />
      </label>
      <label>
        Tags (séparés par des virgules)
        <input name="tags" defaultValue={recipe?.tags.join(", ")} placeholder="dessert, automne" />
      </label>
      <label>
        URL d&apos;une image
        <input name="imageUrl" type="url" defaultValue={recipe?.imageUrl ?? ""} placeholder="https://…" />
      </label>
      <div className="actions">
        <button type="submit" className="btn primary">
          Enregistrer
        </button>
        <Link href={cancelHref} className="btn">
          Annuler
        </Link>
      </div>
    </form>
  );
}

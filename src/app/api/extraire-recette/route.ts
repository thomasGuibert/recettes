import Anthropic from "@anthropic-ai/sdk";
import { extractRecipe, formatIngredient, isExtractionConfigured, type ImageInput } from "@/lib/extract";

// La lecture d'une photo par le modèle prend en général 10 à 40 s.
export const maxDuration = 120;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGES = 4;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function minutes(n: number | null) {
  return n != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function POST(request: Request) {
  if (!isExtractionConfigured()) {
    return error(
      "L'import par photo n'est pas configuré : ajoute la variable ANTHROPIC_API_KEY dans Vercel (voir README).",
      503,
    );
  }

  let images: ImageInput[];
  try {
    const body = (await request.json()) as { images?: { mediaType: string; data: string }[] };
    images = (body.images ?? []).filter(
      (i): i is ImageInput => MEDIA_TYPES.has(i?.mediaType) && typeof i?.data === "string" && i.data.length > 0,
    );
  } catch {
    return error("Requête invalide.", 400);
  }
  if (images.length === 0) return error("Aucune image reçue.", 400);
  if (images.length > MAX_IMAGES) return error(`${MAX_IMAGES} photos maximum.`, 400);

  try {
    const recipe = await extractRecipe(images);
    if (!recipe.title.trim() && recipe.ingredients.length === 0 && recipe.steps.length === 0) {
      return error("Aucune recette trouvée sur cette photo.", 422);
    }
    return Response.json({
      title: recipe.title,
      description: recipe.description,
      servings: minutes(recipe.servings),
      prepMinutes: minutes(recipe.prepMinutes),
      cookMinutes: minutes(recipe.cookMinutes),
      ingredients: recipe.ingredients.map(formatIngredient),
      steps: recipe.steps,
      tags: [...new Set(recipe.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
    });
  } catch (e) {
    console.error("Extraction de recette échouée", e);
    if (e instanceof Anthropic.AuthenticationError) return error("Clé ANTHROPIC_API_KEY invalide.", 500);
    if (e instanceof Anthropic.RateLimitError) return error("Trop de requêtes, réessaie dans une minute.", 429);
    if (e instanceof Anthropic.APIError) return error(`Erreur de l'API Claude (${e.status ?? "réseau"}).`, 502);
    return error(e instanceof Error ? e.message : "Erreur inattendue.", 500);
  }
}

// Extraction d'une recette depuis une ou plusieurs photos (pages de livre, fiches…)
// via l'API Claude (vision + sortie structurée). Utilisé uniquement côté serveur.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5-5";

const IngredientSchema = z.object({
  quantity: z.string().nullable().describe("Quantité telle qu'écrite, en chiffres : \"200\", \"1/2\", \"2-3\". null si absente."),
  unit: z.string().nullable().describe("Unité normalisée (g, kg, ml, cl, l, c. à soupe, c. à café, pincée, gousse, tranche, sachet…). null si aucune."),
  name: z.string().describe("Nom de l'ingrédient, au singulier sauf usage, sans quantité ni unité."),
  note: z.string().nullable().describe("Précision éventuelle : \"tamisée\", \"à température ambiante\", \"facultatif\". null sinon."),
});

export const ExtractedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe("Une ou deux phrases de présentation, vide si rien de pertinent."),
  servings: z.number().nullable(),
  prepMinutes: z.number().nullable().describe("Temps de préparation en minutes (repos inclus s'il est mentionné à part : non)."),
  cookMinutes: z.number().nullable().describe("Temps de cuisson en minutes."),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe("Une étape par élément, sans numérotation."),
  tags: z.array(z.string()).describe("3 à 6 tags courts en minuscules : type de plat, ingrédient principal, saison, régime…"),
});

export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

const SYSTEM = `Tu extrais des recettes de cuisine à partir de photos (pages de livres, fiches, captures d'écran) pour les normaliser dans un format unique, en français.

Règles :
- Recopie fidèlement ce qui est écrit ; n'invente ni ingrédient, ni quantité, ni étape. Si une information est absente, mets null (ou une liste vide).
- Si la recette est dans une autre langue, traduis-la en français.
- Convertis les unités impériales (cups, oz, °F…) en unités métriques usuelles, en arrondissant raisonnablement.
- Les temps sont en minutes (1 h 15 → 75).
- Les étapes sont des phrases complètes, une action principale par étape, sans numéro au début.
- Si plusieurs photos sont fournies, ce sont des pages successives de la même recette.
- Si la photo ne contient pas de recette, renvoie un titre vide et des listes vides.`;

export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

export function isExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractRecipe(images: ImageInput[]): Promise<ExtractedRecipe> {
  try {
    return await callModel(images, true);
  } catch (e) {
    // Si le compte n'a pas accès au repli serveur (bêta), on réessaie sans.
    if (e instanceof Anthropic.BadRequestError && /fallback|beta/i.test(e.apiMessage ?? e.message)) {
      return callModel(images, false);
    }
    throw e;
  }
}

async function callModel(images: ImageInput[], withFallback: boolean): Promise<ExtractedRecipe> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractedRecipeSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
          })),
          { type: "text" as const, text: "Extrais la recette de ces photos." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Le modèle a refusé d'analyser cette image.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("La réponse du modèle est incomplète, réessaie avec une photo plus nette.");
  }
  return response.parsed_output;
}

/** Met un ingrédient structuré sous la forme d'une ligne unique : "200 g farine (tamisée)". */
export function formatIngredient(i: ExtractedRecipe["ingredients"][number]) {
  const head = [i.quantity, i.unit, i.name].filter((s) => s && s.trim()).join(" ");
  return i.note?.trim() ? `${head} (${i.note.trim()})` : head;
}

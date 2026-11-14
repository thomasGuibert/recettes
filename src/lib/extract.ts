// Extraction d'une recette depuis une ou plusieurs photos (pages de livre, fiches…)
// via l'API Gemini de Google (vision + sortie JSON structurée, offre gratuite).
// Utilisé uniquement côté serveur.
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Alias qui suit le dernier modèle « Flash » de Google ; modifiable via GEMINI_MODEL.
export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const IngredientSchema = z.object({
  quantity: z.string().nullable().describe("Quantité telle qu'écrite, en chiffres : \"200\", \"1/2\", \"2-3\". null si absente."),
  unit: z.string().nullable().describe("Unité normalisée (g, kg, ml, cl, l, c. à soupe, c. à café, pincée, gousse, tranche, sachet…). null si aucune."),
  name: z.string().describe("Nom de l'ingrédient, sans quantité ni unité."),
  note: z.string().nullable().describe("Précision éventuelle : \"tamisée\", \"à température ambiante\", \"facultatif\". null sinon."),
});

export const ExtractedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe("Une ou deux phrases de présentation, vide si rien de pertinent."),
  servings: z.number().nullable(),
  prepMinutes: z.number().nullable().describe("Temps de préparation en minutes."),
  cookMinutes: z.number().nullable().describe("Temps de cuisson en minutes."),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe("Une étape par élément, sans numérotation."),
  tags: z.array(z.string()).describe("3 à 6 tags courts en minuscules : type de plat, ingrédient principal, saison, régime…"),
});

export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

// Schéma JSON envoyé à Gemini (sans la clé "$schema", inutile pour l'API).
const { $schema: _ignored, ...RESPONSE_SCHEMA } = z.toJSONSchema(ExtractedRecipeSchema);
void _ignored;

const SYSTEM = `Tu extrais des recettes de cuisine à partir de photos (pages de livres, fiches, captures d'écran) pour les normaliser dans un format unique, en français.

Règles :
- Recopie fidèlement ce qui est écrit ; n'invente ni ingrédient, ni quantité, ni étape. Si une information est absente, mets null (ou une liste vide).
- Si la recette est dans une autre langue, traduis-la en français.
- Convertis les unités impériales (cups, oz, °F…) en unités métriques usuelles, en arrondissant raisonnablement.
- Les temps sont en minutes (1 h 15 → 75).
- Les étapes sont des phrases complètes, une action principale par étape, sans numéro au début.
- Si plusieurs photos sont fournies, ce sont des pages successives de la même recette.
- Si la photo ne contient pas de recette, renvoie un titre vide et des listes vides.`;

export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export function isExtractionConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export async function extractRecipe(images: ImageInput[]): Promise<ExtractedRecipe> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            ...images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.data } })),
            { text: "Extrais la recette de ces photos." },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    });
    text = response.text;
  } catch (e) {
    if (e instanceof ApiError) {
      let detail = e.message;
      try {
        detail = JSON.parse(e.message.slice(e.message.indexOf("{"))).error?.message ?? detail;
      } catch {}
      detail = detail.slice(0, 300);
      if (e.status === 429) throw new ExtractionError(`Quota Gemini gratuit atteint, réessaie dans une minute. (${detail})`, 429);
      if (e.status === 400 && /api key/i.test(detail)) throw new ExtractionError(`Clé GEMINI_API_KEY invalide. (${detail})`, 500);
      if (e.status === 404) throw new ExtractionError(`Modèle Gemini « ${MODEL} » introuvable. (${detail})`, 500);
      throw new ExtractionError(`Erreur de l'API Gemini (${e.status}) : ${detail}`);
    }
    throw e;
  }

  if (!text) throw new ExtractionError("Gemini n'a renvoyé aucune réponse (photo refusée ou illisible).");
  const parsed = ExtractedRecipeSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new ExtractionError("La réponse de Gemini n'a pas le format attendu, réessaie.");
  return parsed.data;
}

/** Met un ingrédient structuré sous la forme d'une ligne unique : "200 g farine (tamisée)". */
export function formatIngredient(i: ExtractedRecipe["ingredients"][number]) {
  const head = [i.quantity, i.unit, i.name].filter((s) => s && s.trim()).join(" ");
  return i.note?.trim() ? `${head} (${i.note.trim()})` : head;
}

// Tout l'accès aux données est ici : pour changer de base (ex. MongoDB),
// il suffit de réimplémenter les fonctions exportées de ce fichier.
import { neon } from "@neondatabase/serverless";

export type Recipe = {
  id: number;
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas défini. Ajoute une base Neon dans l'onglet Storage du projet Vercel (voir README).",
    );
  }
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  schemaReady ??= (async () => {
    const q = sql();
    await q`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        servings INTEGER,
        prep_minutes INTEGER,
        cook_minutes INTEGER,
        ingredients JSONB NOT NULL DEFAULT '[]',
        steps JSONB NOT NULL DEFAULT '[]',
        tags TEXT[] NOT NULL DEFAULT '{}',
        image_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecipe(r: any): Recipe {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    servings: r.servings,
    prepMinutes: r.prep_minutes,
    cookMinutes: r.cook_minutes,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    tags: r.tags ?? [],
    imageUrl: r.image_url,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listRecipes(opts: { q?: string; tag?: string } = {}) {
  await ensureSchema();
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const tag = opts.tag?.trim() || null;
  const rows = await sql()`
    SELECT * FROM recipes
    WHERE (${q}::text IS NULL OR title ILIKE ${q} OR description ILIKE ${q} OR ingredients::text ILIKE ${q})
      AND (${tag}::text IS NULL OR ${tag} = ANY(tags))
    ORDER BY updated_at DESC`;
  return rows.map(toRecipe);
}

export async function listTags() {
  await ensureSchema();
  const rows = await sql()`
    SELECT DISTINCT unnest(tags) AS tag FROM recipes ORDER BY tag`;
  return rows.map((r) => r.tag as string);
}

export async function getRecipe(id: number) {
  await ensureSchema();
  const rows = await sql()`SELECT * FROM recipes WHERE id = ${id}`;
  return rows[0] ? toRecipe(rows[0]) : null;
}

export async function createRecipe(input: RecipeInput) {
  await ensureSchema();
  const rows = await sql()`
    INSERT INTO recipes (title, description, servings, prep_minutes, cook_minutes, ingredients, steps, tags, image_url)
    VALUES (${input.title}, ${input.description}, ${input.servings}, ${input.prepMinutes}, ${input.cookMinutes},
            ${JSON.stringify(input.ingredients)}::jsonb, ${JSON.stringify(input.steps)}::jsonb, ${input.tags}, ${input.imageUrl})
    RETURNING id`;
  return rows[0].id as number;
}

export async function updateRecipe(id: number, input: RecipeInput) {
  await ensureSchema();
  await sql()`
    UPDATE recipes SET
      title = ${input.title}, description = ${input.description}, servings = ${input.servings},
      prep_minutes = ${input.prepMinutes}, cook_minutes = ${input.cookMinutes},
      ingredients = ${JSON.stringify(input.ingredients)}::jsonb, steps = ${JSON.stringify(input.steps)}::jsonb,
      tags = ${input.tags}, image_url = ${input.imageUrl}, updated_at = now()
    WHERE id = ${id}`;
}

export async function deleteRecipe(id: number) {
  await ensureSchema();
  await sql()`DELETE FROM recipes WHERE id = ${id}`;
}

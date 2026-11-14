// Découpage heuristique (sans IA) du texte d'une recette obtenu par OCR :
// repère les sections Ingrédients / Préparation, les portions, les temps,
// et normalise les ingrédients au format « 200 g farine ».

export type ParsedRecipe = {
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
};

const INGREDIENTS_HEADER = /^(les\s+)?ingr[ée]dients?\b/i;
const STEPS_HEADER =
  /^(la\s+)?(pr[ée]paration|recette|[ée]tapes?|instructions?|r[ée]alisation|m[ée]thode|d[ée]roul[ée]|progression|marche\s+[àa]\s+suivre)\b\s*:?\s*$/i;
// Lignes d'en-tête qui ne sont ni titre ni contenu.
const META = /(pr[ée]paration|cuisson|repos|personnes?|portions?|parts?|difficult[ée]|co[uû]t|temps|total)\s*:?/i;

// Puces, y compris telles que l'OCR les lit souvent ("e", "o", "«", "©"…).
const BULLET = /^(?:[\s•·●▪■◦*–—\-+>»«©®¢■□✓✔]+\s*|[eoa]\s+(?=\d))(?=\S)/;
const STEP_NUMBER = /^\s*(?:[ée]tape\s*)?(\d{1,2})\s*[.)°:/-]\s*/i;
const FRACTIONS: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8" };
const QUANTITY = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*(?:-|à)\s*\d+(?:[.,]\d+)?)?|un|une|deux|trois|quatre|cinq|six|huit|dix|douze|quelques|1\/2|1\/4|3\/4)\b/i;

// Unités : forme rencontrée → forme normalisée. L'ordre compte (plus long d'abord).
const UNITS: [RegExp, string][] = [
  [/^(cuill[eè]res?|cuil\.?|c\.?)\s*(?:[àa]\s*)?(soupe|s\.?)\b\.?|^c\.?\s*[àa]\.?\s*s\.?(?=\s|$)|^cs\b|^tbsp\b/i, "c. à soupe"],
  [/^(cuill[eè]res?|cuil\.?|c\.?)\s*(?:[àa]\s*)?(caf[ée]|c\.?)\b\.?|^c\.?\s*[àa]\.?\s*c\.?(?=\s|$)|^cc\b|^tsp\b/i, "c. à café"],
  [/^(kilogrammes?|kilos?|kgs?)\b\.?/i, "kg"],
  [/^(grammes?|grs?|g)\b\.?/i, "g"],
  [/^(milligrammes?|mg)\b\.?/i, "mg"],
  [/^(millilitres?|ml)\b\.?/i, "ml"],
  [/^(centilitres?|cl)\b\.?/i, "cl"],
  [/^(d[ée]cilitres?|dl)\b\.?/i, "dl"],
  [/^(litres?|l)\b\.?/i, "l"],
  [/^pinc[ée]es?\b/i, "pincée"],
  [/^gousses?\b/i, "gousse"],
  [/^tranches?\b/i, "tranche"],
  [/^sachets?\b/i, "sachet"],
  [/^bottes?\b/i, "botte"],
  [/^brins?\b/i, "brin"],
  [/^feuilles?\b/i, "feuille"],
  [/^verres?\b/i, "verre"],
  [/^tasses?\b|^cups?\b/i, "tasse"],
  [/^bo[iî]tes?\b/i, "boîte"],
  [/^noix\s+(?=de\b)/i, "noix"],
  [/^poign[ée]es?\b/i, "poignée"],
  [/^zestes?\s+(?=d)/i, "zeste"],
];

function clean(line: string) {
  let s = line.replace(/[|_~`]+/g, " ").replace(/\s+/g, " ").trim();
  for (const [k, v] of Object.entries(FRACTIONS)) s = s.replaceAll(k, ` ${v}`);
  return s.replace(/\s+/g, " ").trim();
}

/** "1 h 15", "1h15", "45 min", "1 heure 30", "90 mn" → minutes */
export function parseDuration(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:h|heures?)\s*(\d+)?\s*(?:min|mn|minutes?)?|(\d+)\s*(?:min|mn|minutes?)\b/i);
  if (!m) return null;
  if (m[3]) return parseInt(m[3], 10);
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

function findDuration(text: string, label: RegExp) {
  const m = text.match(new RegExp(`${label.source}\\s*:?\\s*([^\\n]{0,30})`, "i"));
  return m ? parseDuration(m[1]) : null;
}

function findServings(text: string) {
  const m =
    text.match(/(\d+)\s*(?:personnes?|pers\.?|portions?|parts?|couverts?|convives)\b/i) ??
    text.match(/(?:pour|portions?|parts?)\s*:?\s*(\d+)\b/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return n > 0 && n < 100 ? n : null;
}

const SERVINGS_LINE = /\d+\s*(?:personnes?|pers\.?|portions?|parts?|couverts?)\b/i;
const isMetaLine = (l: string) => SERVINGS_LINE.test(l) || (META.test(l) && parseDuration(l) !== null && l.length < 80);
const looksLikeIngredient = (l: string) =>
  !isMetaLine(l) && (BULLET.test(l) || QUANTITY.test(l.replace(BULLET, "")));
// Une phrase d'instruction : longue, ou terminée par un point.
const looksLikeStep = (l: string) => !looksLikeIngredient(l) && (l.length > 45 || (/[.!]$/.test(l) && l.length > 25));

/** "200 grammes de farine tamisée" → "200 g farine tamisée" */
export function normalizeIngredient(raw: string) {
  let s = clean(raw).replace(BULLET, "").replace(/[.;,]$/, "").trim();
  const q = s.match(QUANTITY);
  if (!q) return s;
  let quantity = q[0].replace(/\s+/g, "").replace(",", ".").replace(/à/, "-");
  quantity = { un: "1", une: "1", deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", huit: "8", dix: "10", douze: "12" }[
    quantity.toLowerCase()
  ] ?? quantity;
  let rest = s.slice(q[0].length).trim();
  let unit = "";
  for (const [re, norm] of UNITS) {
    const m = rest.match(re);
    if (m) {
      unit = norm;
      rest = rest.slice(m[0].length).trim();
      break;
    }
  }
  const metric = /^(k?g|mg|ml|cl|dl|l|c\. à soupe|c\. à café)$/.test(unit);
  if (metric) rest = rest.replace(/^(de\s+|d['’]\s*)/i, "").trim();
  else if (unit && parseFloat(quantity) > 1 && !/[sx]$/.test(unit)) unit += "s";
  s = [quantity, unit, rest].filter(Boolean).join(" ");
  return s;
}

/** Recolle les lignes coupées par l'OCR : une ligne qui commence par une minuscule prolonge la précédente. */
function joinWrapped(lines: string[], isStart: (l: string) => boolean) {
  const out: string[] = [];
  for (const l of lines) {
    if (out.length && !isStart(l) && /^[a-zàâçéèêëîïôûùüÿœ(,]/.test(l)) out[out.length - 1] += ` ${l}`;
    else out.push(l);
  }
  return out;
}

function splitSteps(lines: string[]) {
  const numbered = lines.filter((l) => STEP_NUMBER.test(l)).length >= 2;
  const steps: string[] = [];
  let current = "";
  const flush = () => {
    const s = current.replace(/\s+/g, " ").trim();
    if (s.length > 2) steps.push(s);
    current = "";
  };
  for (const raw of lines) {
    const l = raw.replace(BULLET, "");
    if (numbered) {
      if (STEP_NUMBER.test(l)) {
        flush();
        current = l.replace(STEP_NUMBER, "");
      } else current += ` ${l}`;
    } else {
      // Sans numérotation : une puce ou une fin de phrase termine l'étape.
      if (BULLET.test(raw) && current) flush();
      current += ` ${l}`;
      if (/[.!]$/.test(l)) flush();
    }
  }
  flush();
  // Recolle les mots coupés par un tiret en fin de ligne : "pré- chauffer" → "préchauffer"
  return steps.map((s) => s.replace(/(\p{L})- (\p{Ll})/gu, "$1$2").replace(/^\p{Ll}/u, (c) => c.toUpperCase()));
}

/** "VELOUTÉ DE POTIRON" → "Velouté de potiron" */
function sentenceCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 1 && /\p{L}|\d/u.test(l));

  let ingIdx = lines.findIndex((l) => INGREDIENTS_HEADER.test(l));
  let hasHeader = ingIdx >= 0;
  if (!hasHeader) {
    // Pas de titre « Ingrédients » : la liste commence à la première ligne qui ressemble à un ingrédient.
    const first = lines.findIndex((l, i) => i > 0 && looksLikeIngredient(l));
    ingIdx = first > 0 ? first - 1 : -1;
    hasHeader = false;
  }
  const stepIdx = lines.findIndex((l, i) => i > ingIdx && STEPS_HEADER.test(l));

  const header = lines.slice(0, ingIdx >= 0 ? (hasHeader ? ingIdx : ingIdx + 1) : Math.min(lines.length, 4));
  let ingredientLines: string[] = [];
  let stepLines: string[];

  if (ingIdx >= 0) {
    const after = lines.slice(ingIdx + 1, stepIdx >= 0 ? stepIdx : undefined).filter((l) => !isMetaLine(l));
    if (stepIdx < 0) {
      // Pas de titre pour les étapes : les ingrédients s'arrêtent à la première phrase d'instruction.
      let end = after.findIndex(looksLikeStep);
      if (end < 0) end = after.length;
      ingredientLines = after.slice(0, end);
      stepLines = after.slice(end);
    } else {
      ingredientLines = after;
      stepLines = lines.slice(stepIdx + 1);
    }
    if (hasHeader) {
      // Ce qui suit « Ingrédients : » sur la même ligne compte aussi.
      const sameLine = lines[ingIdx]
        .replace(INGREDIENTS_HEADER, "")
        .replace(/^\s*\(?pour\s+\d+[^):]*\)?\s*/i, "")
        .replace(/^[^\p{L}\d]*/u, "")
        .trim();
      if (sameLine) ingredientLines.unshift(sameLine);
    }
  } else {
    stepLines = lines.slice(1).filter((l) => !isMetaLine(l));
  }

  const ingredients = joinWrapped(ingredientLines, looksLikeIngredient)
    .filter((l) => !isMetaLine(l))
    .map(normalizeIngredient)
    .filter((l) => l.length > 1);

  const steps = splitSteps(stepLines.filter((l) => !isMetaLine(l)));

  const title =
    header.find((l) => !META.test(l) && /\p{L}{3}/u.test(l) && !looksLikeIngredient(l)) ?? lines[0] ?? "";
  const description = header
    .filter((l) => l !== title && !isMetaLine(l) && !INGREDIENTS_HEADER.test(l) && l.length > 30)
    .join(" ");

  return {
    title: sentenceCase(title.replace(/[.:]$/, "")),
    description,
    servings: findServings(text),
    prepMinutes: findDuration(text, /pr[ée]p(?:aration|\.)?/),
    cookMinutes: findDuration(text, /cuisson/),
    ingredients,
    steps,
    tags: [],
  };
}

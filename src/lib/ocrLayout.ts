// Remet dans l'ordre de lecture le texte d'une page en deux colonnes
// (ingrédients à gauche, préparation à droite), que l'OCR lit ligne à ligne.

type Box = { x0: number; y0: number; x1: number; y1: number };
type OcrWord = { text: string; bbox: Box };
type OcrBlock = { paragraphs: { lines: { words: OcrWord[]; bbox: Box }[] }[] };

type Segment = { text: string; x0: number; x1: number; y: number };

export function textFromBlocks(blocks: OcrBlock[]): string {
  const lines = blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).filter((l) => l.words.length > 0);
  if (lines.length === 0) return "";

  // 1) Coupe chaque ligne là où il y a un grand blanc horizontal entre deux mots.
  const segments: Segment[][] = lines.map((line) => {
    const height = line.bbox.y1 - line.bbox.y0 || 20;
    const words = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const out: Segment[] = [];
    let cur: OcrWord[] = [];
    const push = () => {
      if (cur.length)
        out.push({
          text: cur.map((w) => w.text).join(" "),
          x0: cur[0].bbox.x0,
          x1: cur[cur.length - 1].bbox.x1,
          y: line.bbox.y0,
        });
      cur = [];
    };
    for (const w of words) {
      if (cur.length && w.bbox.x0 - cur[cur.length - 1].bbox.x1 > height * 2.5) push();
      cur.push(w);
    }
    push();
    return out;
  });

  // 2) Cherche une frontière de colonne : le début du 2e segment, partagé par plusieurs lignes.
  const starts = segments.filter((s) => s.length === 2).map((s) => s[1].x0);
  if (starts.length < 3) return lines.map((l) => l.words.map((w) => w.text).join(" ")).join("\n");
  starts.sort((a, b) => a - b);
  const boundary = starts[Math.floor(starts.length / 2)] - 20;

  // 3) Parcourt la page de haut en bas ; une ligne qui traverse la frontière (titre…) sépare des zones,
  //    et dans chaque zone on lit la colonne de gauche puis celle de droite.
  const result: string[] = [];
  let left: string[] = [];
  let right: string[] = [];
  const flush = () => {
    result.push(...left, ...right);
    left = [];
    right = [];
  };
  for (const segs of segments.sort((a, b) => a[0].y - b[0].y)) {
    const spans = segs.length === 1 && segs[0].x0 < boundary && segs[0].x1 > boundary + 40;
    if (spans) {
      flush();
      result.push(segs[0].text);
      continue;
    }
    for (const s of segs) (s.x0 >= boundary ? right : left).push(s.text);
  }
  flush();
  return result.join("\n");
}

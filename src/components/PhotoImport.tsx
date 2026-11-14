"use client";

import { useRef, useState } from "react";
import { parseRecipeText, type ParsedRecipe } from "@/lib/parseRecipeText";
import { textFromBlocks } from "@/lib/ocrLayout";

const MAX_IMAGES = 4;

type Prepared = { canvas: HTMLCanvasElement; preview: string };

// Réduit la photo côté navigateur (les photos de téléphone font souvent 5-10 Mo).
async function prepare(file: File, maxSide: number): Promise<Prepared> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { canvas, preview: canvas.toDataURL("image/jpeg", 0.6) };
}

// Lecture par Gemini (si une clé API est configurée sur le serveur).
async function readWithAi(images: Prepared[]): Promise<ParsedRecipe> {
  const payload = images.map(({ canvas }) => {
    const url = canvas.toDataURL("image/jpeg", 0.9);
    return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
  });
  const res = await fetch("/api/extraire-recette", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: payload }),
  });
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json as ParsedRecipe;
}

// Lecture gratuite dans le navigateur : OCR Tesseract (français) puis découpage heuristique.
async function readWithOcr(images: Prepared[], onProgress: (msg: string) => void): Promise<ParsedRecipe> {
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  const worker = await createWorker("fra", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        const prefix = images.length > 1 ? `Page ${page + 1}/${images.length} : ` : "";
        onProgress(`${prefix}lecture du texte… ${Math.round(m.progress * 100)} %`);
      } else if (m.status.startsWith("loading")) {
        onProgress("Chargement de la lecture de texte (la première fois, quelques secondes)…");
      }
    },
  });
  try {
    const texts: string[] = [];
    for (const img of images) {
      const { data } = await worker.recognize(img.canvas, {}, { blocks: true, text: true });
      texts.push(data.blocks ? textFromBlocks(data.blocks) : data.text);
      page++;
    }
    return parseRecipeText(texts.join("\n"));
  } finally {
    await worker.terminate();
  }
}

function setField(form: HTMLFormElement, name: string, value: string | null | undefined) {
  const el = form.elements.namedItem(name);
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && value) el.value = value;
}

export default function PhotoImport({ mode }: { mode: "ai" | "ocr" }) {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, MAX_IMAGES);
    if (files.length === 0) return;
    setStatus("loading");
    setMessage(files.length > 1 ? `Préparation des ${files.length} photos…` : "Préparation de la photo…");
    try {
      // L'OCR lit mieux une image plus grande.
      const images = await Promise.all(files.map((f) => prepare(f, mode === "ai" ? 2000 : 2400)));
      setPreviews(images.map((i) => i.preview));

      let r: ParsedRecipe;
      let note = "";
      if (mode === "ai") {
        try {
          setMessage("Analyse de la recette…");
          r = await readWithAi(images);
        } catch (e) {
          note = ` (Gemini indisponible : ${e instanceof Error ? e.message : e} ; lecture sans IA utilisée)`;
          r = await readWithOcr(images, setMessage);
        }
      } else {
        r = await readWithOcr(images, setMessage);
      }

      if (!r.title && r.ingredients.length === 0 && r.steps.length === 0) {
        throw new Error("Aucun texte de recette trouvé : essaie une photo plus nette, bien droite et éclairée.");
      }
      const form = root.current?.closest("form");
      if (!form) return;
      setField(form, "title", r.title);
      setField(form, "description", r.description);
      setField(form, "servings", r.servings?.toString());
      setField(form, "prepMinutes", r.prepMinutes?.toString());
      setField(form, "cookMinutes", r.cookMinutes?.toString());
      setField(form, "ingredients", r.ingredients.join("\n"));
      setField(form, "steps", r.steps.join("\n"));
      setField(form, "tags", r.tags.join(", "));
      setStatus("done");
      setMessage(`Formulaire pré-rempli : relis et corrige avant d'enregistrer.${note}`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Impossible de lire la photo.");
    }
  }

  const busy = status === "loading";

  return (
    <div ref={root} className="photo-import">
      <strong>Importer depuis une photo</strong>
      <p className="muted">
        Prends en photo la page de la recette (jusqu&apos;à {MAX_IMAGES} pages) : le formulaire sera rempli
        automatiquement.
        {mode === "ocr" &&
          " Pour un meilleur résultat : page bien à plat, droite, bien éclairée, sans reflet. Les textes manuscrits sont mal reconnus."}
      </p>
      <div className="actions">
        <label className={`btn primary${busy ? " disabled" : ""}`}>
          📷 Prendre une photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={busy}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className={`btn${busy ? " disabled" : ""}`}>
          Choisir des images
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {previews.length > 0 && (
        <div className="photo-previews">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1}`} />
          ))}
        </div>
      )}
      {message && (
        <p className={status === "error" ? "photo-status error" : "photo-status"} role="status">
          {busy && <span className="spinner" aria-hidden />} {message}
        </p>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

type Extracted = {
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
};

const MAX_SIDE = 1568; // au-delà, le modèle redimensionne de toute façon
const MAX_IMAGES = 4;

// Réduit la photo côté navigateur (les photos de téléphone font souvent 5-10 Mo).
async function toJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1), preview: dataUrl };
}

function setField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value;
}

export default function PhotoImport() {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, MAX_IMAGES);
    if (files.length === 0) return;
    setStatus("loading");
    setMessage(files.length > 1 ? `Lecture des ${files.length} photos…` : "Lecture de la photo…");
    try {
      const images = await Promise.all(files.map(toJpeg));
      setPreviews(images.map((i) => i.preview));
      const res = await fetch("/api/extraire-recette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.map(({ mediaType, data }) => ({ mediaType, data })) }),
      });
      const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);

      const r = json as Extracted;
      const form = root.current?.closest("form");
      if (!form) return;
      setField(form, "title", r.title);
      setField(form, "description", r.description);
      setField(form, "servings", r.servings?.toString() ?? "");
      setField(form, "prepMinutes", r.prepMinutes?.toString() ?? "");
      setField(form, "cookMinutes", r.cookMinutes?.toString() ?? "");
      setField(form, "ingredients", r.ingredients.join("\n"));
      setField(form, "steps", r.steps.join("\n"));
      setField(form, "tags", r.tags.join(", "));
      setStatus("done");
      setMessage("Formulaire pré-rempli : relis et corrige avant d'enregistrer.");
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

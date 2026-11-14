# Recettes

Site de gestion de recettes de cuisine : liste, recherche (titre, description, ingrédients), filtre par tag, ajout, modification et suppression.

**Stack** : Next.js 16 (App Router, Server Actions) · Postgres serverless [Neon](https://neon.tech) · déployé sur Vercel.

Tout l'accès aux données est isolé dans `src/lib/db.ts`. La table `recipes` est créée automatiquement à la première requête (ingrédients et étapes en JSONB, tags en `TEXT[]`).

## Déployer sur Vercel

1. Sur [vercel.com/new](https://vercel.com/new), importe le repo GitHub `thomasGuibert/recettes` (framework détecté : Next.js, aucun réglage à changer) et clique sur **Deploy**.
2. Dans le projet Vercel, onglet **Storage** → **Create Database** → **Neon** (offre gratuite) → connecte-la au projet pour tous les environnements. Vercel ajoute automatiquement la variable `DATABASE_URL`.
3. Onglet **Deployments** → sur le dernier déploiement, **Redeploy** pour prendre en compte la variable.

### Import de recette par photo

Le formulaire « Nouvelle recette » peut lire une photo (page de livre, fiche…) et pré-remplir titre, ingrédients, étapes, temps et portions, à relire avant d'enregistrer. Deux modes :

- **Sans IA (par défaut, gratuit)** : reconnaissance de texte [Tesseract.js](https://github.com/naptha/tesseract.js) en français, exécutée dans le navigateur (`src/components/PhotoImport.tsx`), puis découpage par règles (`src/lib/parseRecipeText.ts` : sections Ingrédients / Préparation, quantités et unités, temps, portions ; `src/lib/ocrLayout.ts` remet les pages en deux colonnes dans l'ordre). Limites : mises en page très chargées, photos de travers ou mal éclairées, écriture manuscrite.
- **Avec Gemini (optionnel, gratuit)** : si la variable `GEMINI_API_KEY` est définie dans Vercel, la photo est lue par l'API Gemini de Google (offre gratuite), bien plus fiable sur les mises en page difficiles (tags inclus). Clé : [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key** ; puis Vercel → Settings → Environment Variables → `GEMINI_API_KEY` → Save → Redeploy. Modèle par défaut `gemini-flash-latest`, modifiable avec `GEMINI_MODEL`. En cas d'erreur de l'API, le mode sans IA prend le relais. Attention : avec l'offre gratuite, Google peut utiliser les contenus envoyés pour améliorer ses produits.

Chaque push sur `main` redéploie la production, et chaque pull request reçoit une URL de preview.

## Développement local

```bash
npm install
cp .env.example .env.local   # puis colle l'URL de ta base Neon
# ou, si le projet est lié : npx vercel link && npx vercel env pull .env.local
npm run dev
```

Puis ouvre http://localhost:3000.

> ⚠️ Le site n'a pas d'authentification : toute personne ayant l'URL peut modifier les recettes. Pour le garder privé, active **Vercel Authentication** (Settings → Deployment Protection) ou ajoute une connexion.

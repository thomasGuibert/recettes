# Recettes

Site de gestion de recettes de cuisine : liste, recherche (titre, description, ingrédients), filtre par tag, ajout, modification et suppression.

**Stack** : Next.js 16 (App Router, Server Actions) · Postgres serverless [Neon](https://neon.tech) · déployé sur Vercel.

Tout l'accès aux données est isolé dans `src/lib/db.ts`. La table `recipes` est créée automatiquement à la première requête (ingrédients et étapes en JSONB, tags en `TEXT[]`).

## Déployer sur Vercel

1. Sur [vercel.com/new](https://vercel.com/new), importe le repo GitHub `thomasGuibert/recettes` (framework détecté : Next.js, aucun réglage à changer) et clique sur **Deploy**.
2. Dans le projet Vercel, onglet **Storage** → **Create Database** → **Neon** (offre gratuite) → connecte-la au projet pour tous les environnements. Vercel ajoute automatiquement la variable `DATABASE_URL`.
3. Onglet **Deployments** → sur le dernier déploiement, **Redeploy** pour prendre en compte la variable.

### Import de recette par photo

Le formulaire « Nouvelle recette » peut lire une photo (page de livre, fiche…) avec l'API Claude et pré-remplir titre, ingrédients, étapes, temps, portions et tags. Il faut une clé API Anthropic :

1. Crée une clé sur [platform.claude.com](https://platform.claude.com/settings/keys) (**API Keys** → **Create Key**) et ajoute un peu de crédit dans **Billing**.
2. Dans le projet Vercel : **Settings** → **Environment Variables** → nom `ANTHROPIC_API_KEY`, valeur = la clé, environnements Production et Preview → **Save**.
3. **Deployments** → **Redeploy** sur le dernier déploiement.

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

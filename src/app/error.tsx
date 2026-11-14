"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="notice">
      <h1>Oups, une erreur est survenue</h1>
      <p>
        Vérifie que la base Neon est bien connectée au projet Vercel, puis consulte les logs du déploiement (onglet
        Logs) pour le détail.
      </p>
      <button className="btn" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}

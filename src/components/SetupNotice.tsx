export default function SetupNotice() {
  return (
    <div className="notice">
      <h1>Base de données non configurée</h1>
      <p>Le site est en ligne, mais il ne trouve pas de base pour stocker les recettes. Sur Vercel :</p>
      <ol>
        <li>
          Ouvre le projet, onglet <strong>Storage</strong> → <strong>Create Database</strong> → <strong>Neon</strong>,
          puis connecte la base au projet (tous les environnements).
        </li>
        <li>
          Onglet <strong>Deployments</strong> → <strong>Redeploy</strong> sur le dernier déploiement.
        </li>
      </ol>
      <p>
        Le site cherche la variable <code>DATABASE_URL</code> (ou <code>POSTGRES_URL</code>).
      </p>
    </div>
  );
}

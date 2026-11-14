import Link from "next/link";
import { isDbConfigured, listRecipes, listTags } from "@/lib/db";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  if (!isDbConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [recipes, tags] = await Promise.all([listRecipes({ q, tag }), listTags()]);

  return (
    <>
      <form className="search" action="/">
        <input name="q" defaultValue={q} placeholder="Rechercher une recette, un ingrédient…" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="btn" type="submit">
          Rechercher
        </button>
      </form>

      {tags.length > 0 && (
        <nav className="tags">
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className={!tag ? "tag active" : "tag"}>
            Toutes
          </Link>
          {tags.map((t) => (
            <Link
              key={t}
              href={`/?${new URLSearchParams({ ...(q && { q }), tag: t })}`}
              className={t === tag ? "tag active" : "tag"}
            >
              {t}
            </Link>
          ))}
        </nav>
      )}

      {recipes.length === 0 ? (
        <p className="empty">
          {q || tag ? "Aucune recette ne correspond." : "Aucune recette pour l'instant. "}
          {!q && !tag && <Link href="/recettes/nouvelle">Ajoute la première !</Link>}
        </p>
      ) : (
        <ul className="grid">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link href={`/recettes/${r.id}`} className="card">
                {r.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" />
                )}
                <div className="card-body">
                  <h2>{r.title}</h2>
                  {r.description && <p>{r.description}</p>}
                  <small>
                    {[
                      r.prepMinutes != null || r.cookMinutes != null
                        ? `⏱ ${(r.prepMinutes ?? 0) + (r.cookMinutes ?? 0)} min`
                        : null,
                      r.servings ? `🍽 ${r.servings} pers.` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

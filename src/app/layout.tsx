import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recettes",
  description: "Mes recettes de cuisine",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <header className="header">
          <Link href="/" className="logo">
            🍲 Recettes
          </Link>
          <Link href="/recettes/nouvelle" className="btn primary">
            + Nouvelle recette
          </Link>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}

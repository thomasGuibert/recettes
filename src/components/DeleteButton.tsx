"use client";

export default function DeleteButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer cette recette ?")) e.preventDefault();
      }}
    >
      <button type="submit" className="btn danger">
        Supprimer
      </button>
    </form>
  );
}

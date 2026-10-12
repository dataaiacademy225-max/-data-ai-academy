import { APP_NAME_PARTS } from "@/lib/brand";

/** Logo texte de l'outil : « Griot » + « Cite » en orange. */
export function BrandName() {
  return (
    <>
      {APP_NAME_PARTS.main}
      <span className="text-accent">{APP_NAME_PARTS.accent}</span>
    </>
  );
}

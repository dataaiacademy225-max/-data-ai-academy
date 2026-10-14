"""Nettoie un lien PostgreSQL copié-collé dans un secret GitHub, sans jamais l'afficher.

Usage : python3 clean-database-url.py NOM_DE_LA_VARIABLE FICHIER_DE_SORTIE

Corrige les erreurs de collage courantes : espaces et retours à la ligne, guillemets,
préfixe « DATABASE_URL= » ou « psql », lien collé deux fois, paramètres en trop.
Écrit « PGURL=<lien propre> » dans le fichier de sortie (format --env-file de Docker).
Seule la nature des corrections est affichée, jamais le lien.
"""

import os
import re
import sys
from urllib.parse import urlsplit, urlunsplit

SCHEME = re.compile(r"postgres(?:ql)?://")


def clean(raw: str) -> tuple[str, list[str]]:
    fixes: list[str] = []
    text = raw.strip()
    if text != raw:
        fixes.append("espaces ou retours à la ligne retirés")

    starts = [m.start() for m in SCHEME.finditer(text)]
    if not starts:
        raise ValueError("le lien ne contient pas « postgresql:// »")
    if starts[0] > 0:
        fixes.append("texte avant « postgresql:// » retiré")
    if len(starts) > 1:
        fixes.append("lien collé plusieurs fois : seul le premier est gardé")
    end = starts[1] if len(starts) > 1 else len(text)
    url = text[starts[0]:end]

    # Le lien s'arrête au premier espace ou guillemet (fin de collage, guillemets de psql…).
    cut = re.search(r"[\s'\"]", url)
    if cut:
        url = url[: cut.start()]
        fixes.append("texte après le lien retiré")

    parts = urlsplit(url)
    if not parts.hostname or not parts.path.strip("/"):
        raise ValueError("le lien n'indique pas de serveur ou de base")
    # Neon exige le chiffrement ; les autres paramètres (channel_binding…) sont inutiles à pg_dump.
    if parts.query != "sslmode=require" or parts.fragment:
        fixes.append("paramètres remplacés par « sslmode=require »")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "sslmode=require", "")), fixes


def main() -> int:
    name, output = sys.argv[1], sys.argv[2]
    try:
        url, fixes = clean(os.environ.get(name, ""))
    except ValueError as error:
        print(f"::error title=Lien {name} invalide::{error}. Recollez le lien depuis Render.")
        return 1
    # Masque le lien nettoyé dans les journaux, comme le secret d'origine.
    print(f"::add-mask::{url}")
    for fix in fixes:
        print(f"::notice title=Lien {name} corrigé::{fix}.")
    old_umask = os.umask(0o077)
    try:
        with open(output, "w", encoding="utf-8") as handle:
            handle.write(f"PGURL={url}\n")
    finally:
        os.umask(old_umask)
    return 0


if __name__ == "__main__":
    sys.exit(main())

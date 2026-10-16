/**
 * Page d'accueil FICTIVE servant aux données de démonstration (domaine réservé example.com).
 * Elle est volontairement imparfaite pour que le rapport de démonstration montre forces et faiblesses.
 */
export const DEMO_SITE_URL = "https://www.example.com/";

export const DEMO_HOME_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>[DÉMO] Cabinet Exemple Conseil</title>
  <meta name="description" content="Cabinet de conseil en data fictif utilisé pour la démonstration de GriotCite.">
  <link rel="canonical" href="https://www.example.com/">
  <meta property="og:title" content="[DÉMO] Cabinet Exemple Conseil">
</head>
<body>
  <nav>
    <a href="/">Accueil</a>
    <a href="/services">Nos services</a>
    <a href="/blog">Blog</a>
    <a href="/a-propos">À propos</a>
  </nav>
  <main>
    <h1>Bienvenue chez Cabinet Exemple Conseil</h1>
    <p>Cabinet de conseil en data fondé à Abidjan, nous accompagnons les organisations dans la structuration, la gouvernance, la valorisation et l'exploitation de leurs données au service d'une stratégie de transformation numérique ambitieuse et durable sur le long terme.</p>
    <a class="btn" href="/services">En savoir plus</a>
    <h2>Nos domaines d'intervention</h2>
    <p>Gouvernance des données, tableaux de bord, formation des équipes et accompagnement des directions. Nous intervenons auprès des dirigeants de PME comme des grands comptes.</p>
    <h2>Nos résultats</h2>
    <p>Plus de 40 entreprises accompagnées depuis 2018.</p>
    <img src="/equipe.png">
    <img src="/bureau.png" alt="Nos bureaux à Abidjan">
  </main>
  <footer>
    <a href="mailto:contact@example.com">Écrivez-nous</a>
    <a href="https://www.linkedin.com/company/example">LinkedIn</a>
  </footer>
</body>
</html>`;

/**
 * Sites concurrents FICTIFS de la comparaison de démonstration (domaine réservé example.org).
 * Le concurrent A est plus clair et mieux balisé que le site de démonstration ; le B l'est moins.
 */
export const DEMO_COMPETITORS = [
  {
    name: "Concurrent A",
    url: "https://a.example.org/",
    html: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>[DÉMO] Concurrent A : conseil data pour les PME d'Abidjan</title>
  <meta name="description" content="[DÉMO] Concurrent A aide les dirigeants de PME d'Abidjan à piloter leur activité avec des tableaux de bord fiables.">
  <link rel="canonical" href="https://a.example.org/">
  <meta property="og:title" content="[DÉMO] Concurrent A">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"[DÉMO] Concurrent A","url":"https://a.example.org/","address":{"@type":"PostalAddress","addressLocality":"Abidjan","addressCountry":"CI"},"telephone":"+225 00 00 00 00"}</script>
</head>
<body>
  <nav>
    <a href="/">Accueil</a>
    <a href="/offres">Nos offres</a>
    <a href="/references">Références</a>
    <a href="/contact">Contact</a>
  </nav>
  <main>
    <h1>Conseil data pour les PME d'Abidjan</h1>
    <p>Nous aidons les dirigeants de PME B2B à piloter leur activité avec des tableaux de bord fiables, en six semaines.</p>
    <a class="btn" href="/contact">Demander un diagnostic gratuit</a>
    <h2>Ils nous font confiance</h2>
    <p>« Nos chiffres de vente sont enfin fiables. » — Directrice commerciale, PME de distribution (exemple fictif).</p>
    <img src="/equipe.png" alt="L'équipe du Concurrent A">
    <h2>Contact</h2>
    <p>Téléphone : +225 00 00 00 00 · Plateau, Abidjan</p>
  </main>
  <footer><a href="mailto:contact@a.example.org">contact@a.example.org</a></footer>
</body>
</html>`,
  },
  {
    name: "Concurrent B",
    url: "https://www.example.org/",
    html: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>[DÉMO] Accueil</title>
</head>
<body>
  <main>
    <h1>Bienvenue</h1>
    <h1>Solutions innovantes pour votre succès</h1>
    <p>Nous proposons des solutions sur mesure pour accompagner votre croissance.</p>
    <img src="/banniere.png">
  </main>
</body>
</html>`,
  },
] as const;

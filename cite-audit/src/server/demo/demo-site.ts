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
  <meta name="description" content="Cabinet de conseil en data fictif utilisé pour la démonstration de CITE Audit.">
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

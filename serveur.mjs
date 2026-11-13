/**
 * Sert le site statique LMB sur cette machine, sans dépendance externe.
 * Lancement : npm start
 * Adresse : http://localhost:3000/
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL(".", import.meta.url));
const HOTE = "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Résout un chemin demandé en restant strictement dans le dossier du site. */
function cheminLocal(urlDemandee) {
  const brut = decodeURIComponent(urlDemandee.split("?")[0]);
  const relatif = brut === "/" ? "index.html" : brut.replace(/^\/+/, "");
  const absolu = normalize(join(RACINE, relatif));
  if (absolu !== RACINE && !absolu.startsWith(RACINE.endsWith(sep) ? RACINE : RACINE + sep)) {
    return null;
  }
  return absolu;
}

const serveur = createServer(async (requete, reponse) => {
  if (requete.method !== "GET" && requete.method !== "HEAD") {
    reponse.writeHead(405, { Allow: "GET, HEAD" });
    reponse.end("Méthode non autorisée");
    return;
  }

  const cible = cheminLocal(requete.url ?? "/");
  if (!cible) {
    reponse.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    reponse.end("Accès refusé");
    return;
  }

  try {
    const info = await stat(cible);
    const fichier = info.isDirectory() ? join(cible, "index.html") : cible;
    const contenu = await readFile(fichier);
    const type = TYPES[extname(fichier).toLowerCase()] ?? "application/octet-stream";
    reponse.writeHead(200, {
      "Content-Type": type,
      "Content-Length": contenu.length,
      "Cache-Control": "no-cache",
    });
    reponse.end(requete.method === "HEAD" ? undefined : contenu);
  } catch {
    reponse.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    reponse.end("Introuvable");
  }
});

serveur.listen(PORT, HOTE, () => {
  console.log(`LMB est disponible sur http://localhost:${PORT}/`);
});

// Les tâches du tableau, sauvegardées dans localStorage.

export type Colonne = "a_faire" | "en_cours" | "termine";

export interface Tache {
  id: string;
  titre: string;
  colonne: Colonne;
}

export const COLONNES: Record<Colonne, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

const CLE = "kanban-webmcp:taches";

const EXEMPLES: Tache[] = [
  { id: "t1", titre: "Créer la maquette de la page d'accueil", colonne: "a_faire" },
  { id: "t2", titre: "Dessiner le logo de la chaîne", colonne: "a_faire" },
  { id: "t3", titre: "Choisir la palette de couleurs du site", colonne: "en_cours" },
  { id: "t4", titre: "Rédiger le script de la vidéo", colonne: "en_cours" },
  { id: "t5", titre: "Configurer le projet Vite", colonne: "termine" },
];

let taches: Tache[] = charger();

function charger(): Tache[] {
  const json = localStorage.getItem(CLE);
  return json ? JSON.parse(json) : structuredClone(EXEMPLES);
}

function sauver() {
  localStorage.setItem(CLE, JSON.stringify(taches));
}

function verifierColonne(colonne: string): asserts colonne is Colonne {
  if (!(colonne in COLONNES)) {
    throw new Error(`Colonne inconnue « ${colonne} ». Valeurs possibles : a_faire, en_cours, termine.`);
  }
}

function trouver(id: string): Tache {
  const tache = taches.find((t) => t.id === id);
  if (!tache) throw new Error(`Aucune tâche avec l'id « ${id} ». Utilisez lister_taches pour voir les id.`);
  return tache;
}

function prochainId(): string {
  const max = Math.max(0, ...taches.map((t) => Number(t.id.slice(1)) || 0));
  return `t${max + 1}`;
}

export function lister(): Tache[] {
  return taches.map((t) => ({ ...t }));
}

export function ajouter(titre: string, colonne: string = "a_faire"): Tache {
  titre = String(titre ?? "").trim();
  if (!titre) throw new Error("Le titre de la tâche est obligatoire.");
  verifierColonne(colonne);
  const tache: Tache = { id: prochainId(), titre, colonne };
  taches.push(tache);
  sauver();
  return { ...tache };
}

export function deplacer(id: string, colonne: string): Tache {
  verifierColonne(colonne);
  const tache = trouver(id);
  tache.colonne = colonne;
  sauver();
  return { ...tache };
}

export function supprimer(id: string): Tache {
  const tache = trouver(id);
  taches = taches.filter((t) => t !== tache);
  sauver();
  return tache;
}

export function reinitialiser() {
  taches = structuredClone(EXEMPLES);
  sauver();
}

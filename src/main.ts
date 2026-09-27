import "./style.css";
import { COLONNES, lister, ajouter, deplacer, supprimer, reinitialiser, type Colonne } from "./store";
import { webmcpDisponible, attendreRelais, activer, desactiver } from "./webmcp";

const $ = <T extends HTMLElement>(selecteur: string) => document.querySelector<T>(selecteur)!;
const tableau = $("#tableau");
const journal = $("#journal");
const toggle = $<HTMLInputElement>("#toggle-webmcp");
const ORDRE = Object.keys(COLONNES) as Colonne[];

const echapper = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- Tableau Kanban ----------

function afficher() {
  const taches = lister();
  tableau.innerHTML = ORDRE.map((colonne) => {
    const cartes = taches.filter((t) => t.colonne === colonne);
    return `
      <div class="colonne ${colonne}" data-colonne="${colonne}">
        <h2>${COLONNES[colonne]} <span class="compteur">${cartes.length}</span></h2>
        ${cartes
          .map(
            (t) => `
          <article class="carte" data-id="${t.id}" draggable="true">
            <span class="id">${t.id}</span>
            <button class="supprimer" title="Supprimer">×</button>
            <p>${echapper(t.titre)}</p>
          </article>`,
          )
          .join("")}
      </div>`;
  }).join("");
}

// Suppression manuelle (bouton × des cartes)
tableau.addEventListener("click", (e) => {
  const bouton = (e.target as HTMLElement).closest(".supprimer");
  const id = bouton?.closest<HTMLElement>(".carte")?.dataset.id;
  if (!id) return;
  supprimer(id);
  afficher();
});

// ---------- Glisser-déposer ----------

const colonneSous = (e: DragEvent) => (e.target as HTMLElement).closest<HTMLElement>(".colonne");

tableau.addEventListener("dragstart", (e) => {
  const carte = (e.target as HTMLElement).closest<HTMLElement>(".carte");
  if (!carte) return;
  e.dataTransfer!.setData("text/plain", carte.dataset.id!);
  carte.classList.add("en-deplacement");
});

tableau.addEventListener("dragend", () => {
  tableau.querySelectorAll(".en-deplacement, .survolee").forEach((el) => el.classList.remove("en-deplacement", "survolee"));
});

tableau.addEventListener("dragover", (e) => {
  const colonne = colonneSous(e);
  if (!colonne) return;
  e.preventDefault(); // autorise le dépôt
  tableau.querySelectorAll(".survolee").forEach((el) => el !== colonne && el.classList.remove("survolee"));
  colonne.classList.add("survolee");
});

tableau.addEventListener("drop", (e) => {
  const colonne = colonneSous(e);
  const id = e.dataTransfer!.getData("text/plain");
  if (!colonne || !id) return;
  e.preventDefault();
  deplacer(id, colonne.dataset.colonne!);
  afficher();
});

$("#formulaire").addEventListener("submit", (e) => {
  e.preventDefault();
  const champ = $<HTMLInputElement>("#nouveau-titre");
  if (champ.value.trim()) ajouter(champ.value);
  champ.value = "";
  afficher();
});

$("#reinitialiser").addEventListener("click", () => {
  reinitialiser();
  afficher();
});

// ---------- Surbrillance des cartes touchées par l'agent ----------

function surligner(ids: string[], classe = "surbrillance") {
  for (const id of ids) {
    const carte = tableau.querySelector(`[data-id="${id}"]`);
    carte?.classList.remove(classe);
    void (carte as HTMLElement | null)?.offsetWidth; // relance l'animation
    carte?.classList.add(classe);
  }
}

// ---------- Journal de l'agent ----------

function ajouterAuJournal(titre: string, details = "", erreur = false) {
  const heure = new Date().toLocaleTimeString("fr-FR");
  const entree = document.createElement("li");
  entree.className = erreur ? "erreur" : "";
  entree.innerHTML = `<div class="entete"><time>${heure}</time> <strong>${echapper(titre)}</strong></div>${details}`;
  journal.prepend(entree);
}

const bloc = (label: string, valeur: unknown) =>
  `<div class="bloc"><span>${label}</span><pre>${echapper(JSON.stringify(valeur, null, 2))}</pre></div>`;

// Appelé par webmcp.ts à chaque appel d'outil par l'agent
function surAppel(outil: string, args: any, resultat: any) {
  ajouterAuJournal(outil, bloc("Arguments", args ?? {}) + bloc("Résultat", resultat), "erreur" in resultat);
  if ("erreur" in resultat) return;

  if (outil === "supprimer_tache") {
    surligner([resultat.supprimee.id], "suppression"); // on montre la carte, puis on la retire
    setTimeout(afficher, 1500);
    return;
  }
  afficher();
  if (outil === "lister_taches") surligner(resultat.taches.map((t: { id: string }) => t.id));
  else surligner([resultat.tache.id]);
}

$("#vider-journal").addEventListener("click", () => (journal.innerHTML = ""));

// ---------- Interrupteur WebMCP ----------

const CLE_ACTIF = "kanban-webmcp:actif";

async function changerEtat(actif: boolean) {
  toggle.checked = actif;
  $("#etat-webmcp").textContent = `WebMCP : ${actif ? "activé" : "désactivé"}`;
  document.body.classList.toggle("webmcp-actif", actif);
  localStorage.setItem(CLE_ACTIF, String(actif));
  try {
    if (actif) await activer(surAppel);
    else desactiver();
    ajouterAuJournal(actif ? "✅ Outils enregistrés (4)" : "⛔ Outils retirés");
  } catch (e) {
    desactiver();
    toggle.checked = false;
    ajouterAuJournal(`Échec de l'enregistrement : ${(e as Error).message}`, "", true);
  }
}

toggle.addEventListener("change", () => changerEtat(toggle.checked));

// ---------- Démarrage ----------

afficher();

await attendreRelais();

if (webmcpDisponible()) {
  if (localStorage.getItem(CLE_ACTIF) !== "false") changerEtat(true);
} else {
  toggle.disabled = true;
  toggle.checked = false;
  $("#etat-webmcp").textContent = "WebMCP : désactivé";
  ajouterAuJournal("WebMCP non disponible", "", true);
  console.warn("[WebMCP] WebMCP non disponible : ni document.modelContext ni navigator.modelContext.");
  const banniere = $("#banniere");
  banniere.hidden = false;
  banniere.innerHTML = `
    <strong>WebMCP n'est pas disponible dans ce navigateur.</strong>
    Utilisez Chrome 150 ou plus récent, ouvrez <code>chrome://flags/#enable-webmcp-testing</code>,
    passez l'option sur <em>Enabled</em>, puis relancez Chrome.`;
}

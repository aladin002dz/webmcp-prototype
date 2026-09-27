// Tout le code WebMCP de l'application est dans ce fichier.
import { lister, ajouter, deplacer, supprimer } from "./store";

// Appelé après chaque action de l'agent (journal + surbrillance dans l'UI)
export type SurAppel = (outil: string, args: any, resultat: any) => void;

// Schémas JSON réutilisés pour les paramètres
const id = { type: "string", description: "Id de la tâche, ex. t1" };
const colonne = {
  type: "string",
  enum: ["a_faire", "en_cours", "termine"],
  description: "a_faire = À faire, en_cours = En cours, termine = Terminé",
};

// Les 4 outils exposés à l'agent
const outils = [
  {
    name: "lister_taches",
    description: "Liste toutes les tâches du tableau Kanban (id, titre, colonne).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    action: () => ({ taches: lister() }),
  },
  {
    name: "ajouter_tache",
    description: "Ajoute une tâche au tableau. Par défaut dans la colonne a_faire.",
    inputSchema: {
      type: "object",
      properties: { titre: { type: "string", description: "Titre de la tâche" }, colonne },
      required: ["titre"],
    },
    action: (a: any) => ({ tache: ajouter(a.titre, a.colonne) }),
  },
  {
    name: "deplacer_tache",
    description: "Déplace une tâche (par son id) vers une autre colonne.",
    inputSchema: { type: "object", properties: { id, colonne }, required: ["id", "colonne"] },
    action: (a: any) => ({ tache: deplacer(a.id, a.colonne) }),
  },
  {
    name: "supprimer_tache",
    description: "Supprime définitivement une tâche (par son id).",
    inputSchema: { type: "object", properties: { id }, required: ["id"] },
    action: (a: any) => ({ supprimee: supprimer(a.id) }),
  },
];

// API native (document) d'abord, puis l'ancien emplacement / le polyfill (navigator)
export function getModelContext(): ModelContext | null {
  return document.modelContext ?? navigator.modelContext ?? null;
}

// Le navigateur supporte-t-il WebMCP ?
export const webmcpDisponible = () => getModelContext() !== null;

// Attend la fin du chargement du script du relais (index.html), 5 s au plus
export function attendreRelais(): Promise<void> {
  const script = document.querySelector<HTMLScriptElement>("#relais-webmcp");
  if (!script || script.dataset.etat) return Promise.resolve();
  return new Promise((fin) => {
    const delai = setTimeout(() => {
      console.warn("[WebMCP] Le relais ne s'est pas chargé en 5 s, on continue sans lui.");
      fin();
    }, 5000);
    const termine = () => { clearTimeout(delai); fin(); };
    script.addEventListener("load", termine, { once: true });
    script.addEventListener("error", () => {
      console.error("[WebMCP] Échec du chargement du relais :", script.src);
      termine();
    }, { once: true });
  });
}

// Retire les outils : l'agent ne les voit plus.
// Le contrôleur vit sur window pour survivre à une ré-exécution du module (HMR).
export function desactiver() {
  window.__webmcpControleur?.abort();
  window.__webmcpControleur = undefined;
  const contexte = getModelContext();
  if (typeof contexte?.unregisterTool !== "function") return;
  // Polyfills sans support de signal : retrait explicite par nom
  for (const { name } of outils) {
    try { contexte.unregisterTool(name); } catch { /* déjà retiré */ }
  }
}

// Enregistre les outils auprès du navigateur (jamais deux fois : on retire d'abord)
export async function activer(surAppel: SurAppel) {
  const contexte = getModelContext();
  if (!contexte) throw new Error("WebMCP non disponible");
  desactiver();
  const controleur = new AbortController();
  window.__webmcpControleur = controleur;

  for (const { action, ...outil } of outils) {
    try {
      await contexte.registerTool(
        {
          ...outil,
          execute: async (args) => {
            let resultat;
            try { resultat = action(args ?? {}); }
            catch (e) {
              resultat = { erreur: (e as Error).message }; // message clair pour l'agent
              console.error(`[WebMCP] Échec de l'appel de « ${outil.name} » :`, e, "arguments :", args);
            }
            surAppel(outil.name, args, resultat);
            return JSON.stringify(resultat);
          },
        },
        { signal: controleur.signal },
      );
    } catch (e) {
      console.error(`[WebMCP] Échec de l'enregistrement de « ${outil.name} » :`, e);
      desactiver();
      throw new Error(`« ${outil.name} » : ${(e as Error).message}`);
    }
  }
  console.info(`[WebMCP] ${outils.length} outils enregistrés.`);
}

// Vite HMR : on retire les outils de l'ancienne version du module
import.meta.hot?.dispose(desactiver);

// Test depuis la console (dev uniquement) : window.__webmcpTest()
if (import.meta.env.DEV) {
  window.__webmcpTest = async () => {
    const contexte = getModelContext();
    if (!contexte?.getTools || !contexte.executeTool) {
      console.error("[WebMCP test] getTools/executeTool indisponibles sur", contexte);
      return;
    }
    const liste = await contexte.getTools();
    console.log("[WebMCP test] getTools() :", liste.map((t) => t.name));
    const outil = liste.find((t) => t.name === "lister_taches");
    if (!outil) {
      console.error("[WebMCP test] lister_taches introuvable");
      return;
    }
    const resultat = await contexte.executeTool(outil, "{}");
    console.log("[WebMCP test] executeTool(lister_taches) :", resultat === null ? null : JSON.parse(resultat));
  };
}

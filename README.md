# Kanban WebMCP

Un petit tableau Kanban (« À faire », « En cours », « Terminé ») qui expose des **outils WebMCP** :
un agent IA peut lister, ajouter, déplacer et supprimer des tâches directement dans la page.

- `src/webmcp.ts` : **tout** le code WebMCP (définition, enregistrement, retrait et test des outils)
- `src/modelcontext.d.ts` : les types TypeScript de l'API WebMCP
- `src/store.ts` : les tâches (sauvegardées dans `localStorage`)
- `src/main.ts` : l'interface (tableau, journal de l'agent, interrupteur)

> WebMCP est **expérimental** et l'API change encore. Ce projet utilise `document.modelContext`,
> avec un repli sur `navigator.modelContext` (ancien nom, obsolète depuis Chrome 150, encore utilisé
> par certains polyfills). Le fonctionnement détaillé est expliqué en [section 6](#6-fonctionnement-technique).

---

## 1. Installation

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

Ouvrez ensuite <http://localhost:5173>.

## 2. Activer WebMCP dans Chrome

1. Utilisez **Chrome 150 ou plus récent** (Stable, Beta ou Canary).
2. Ouvrez `chrome://flags/#enable-webmcp-testing`.
3. Passez **WebMCP for testing** sur **Enabled**, puis cliquez sur **Relaunch**.

Sans ce flag, la page affiche un bandeau orange et l'interrupteur est grisé : l'application
fonctionne quand même, mais sans les outils pour l'agent.

> En production (hors `localhost`), il faudrait un jeton d'*origin trial* (Chrome 149 à 156).

## 3. Connecter un agent

### Option A : Claude Desktop (ou Claude Code), recommandée pour la vidéo

La page charge déjà le script `embed.js` de
[`@mcp-b/webmcp-local-relay`](https://github.com/WebMCP-org/npm-packages/tree/main/packages/webmcp-local-relay)
(voir `index.html`). Ce relais local transmet les outils de l'onglet à votre client MCP.

1. Dans Claude Desktop : **Paramètres → Développeur → Modifier la configuration**, puis ajoutez :

   ```json
   {
     "mcpServers": {
       "webmcp-local-relay": {
         "command": "npx",
         "args": ["-y", "@mcp-b/webmcp-local-relay@latest"]
       }
     }
   }
   ```

   Avec Claude Code, la commande équivalente est :

   ```bash
   claude mcp add webmcp-local-relay -- npx -y @mcp-b/webmcp-local-relay@latest
   ```

2. Redémarrez Claude Desktop.
3. Ouvrez (ou rechargez) <http://localhost:5173> dans Chrome et laissez l'onglet ouvert.
4. Dans Claude, les outils `lister_taches`, `ajouter_tache`, `deplacer_tache` et `supprimer_tache`
   apparaissent à côté des outils du relais (`webmcp_list_sources`, `webmcp_list_tools`…).

Le relais écoute uniquement sur `127.0.0.1:9333`.

### Option B : extension « Model Context Tool Inspector »

L'extension officielle de Chrome liste les outils de la page et permet de les appeler à la main,
ou via Gemini. C'est pratique pour vérifier que les outils sont bien enregistrés.

## 4. Tester en pratique

**Étape 1 : sans outils.** Mettez l'interrupteur sur **« WebMCP : désactivé »** et demandez à l'agent :

> Quelles tâches sont sur mon tableau Kanban ?

L'agent ne trouve aucun outil pour lire le tableau : il ne peut pas répondre.

**Étape 2 : avec outils.** Remettez l'interrupteur sur **« WebMCP : activé »**. Selon le client,
demandez-lui de relister les outils (ou relancez la conversation), puis enchaînez :

1. **Lecture simple**
   > Quelles tâches sont sur mon tableau Kanban ?

2. **Ajout**
   > Ajoute une tâche « Enregistrer l'introduction » dans la colonne En cours.

3. **Déplacement par le titre** (l'agent doit d'abord retrouver l'id)
   > J'ai fini de rédiger le script de la vidéo, mets à jour le tableau.

4. **Plusieurs étapes avec du raisonnement**
   > Déplace toutes les tâches liées au design vers Terminé.

5. **Ménage complet**
   > Supprime toutes les tâches terminées, ajoute « Publier la vidéo » dans À faire, puis résume-moi le tableau final.

**Bonus : gestion d'erreur.**
> Supprime la tâche t99.

L'outil renvoie un message clair (« Aucune tâche avec l'id « t99 »… »), visible en rouge dans le journal.

Pendant la démo, chaque appel fait briller la carte concernée pendant 1,5 s (en rouge pour une
suppression) et s'affiche dans le **Journal de l'agent** avec l'heure, les arguments et le résultat.

## 5. Les outils exposés

| Outil             | Paramètres                                            | Résultat                    |
| ----------------- | ----------------------------------------------------- | --------------------------- |
| `lister_taches`   | aucun                                                 | `{ taches: [...] }`         |
| `ajouter_tache`   | `titre`, `colonne?` (`a_faire`/`en_cours`/`termine`)  | `{ tache }`                 |
| `deplacer_tache`  | `id`, `colonne`                                       | `{ tache }`                 |
| `supprimer_tache` | `id`                                                  | `{ supprimee }`             |

En cas de problème, l'outil renvoie `{ erreur: "message" }`.

## 6. Fonctionnement technique

### Vue d'ensemble

```
 Agent (Codex, Claude, Gemini…)
        │  découvre et appelle les outils
        ▼
 Chrome ── document.modelContext ──► registerTool / getTools / executeTool
        ▲                                     │
        │ enregistre les 4 outils             │ appelle execute(args)
        │                                     ▼
 src/webmcp.ts ──────────────────────► src/store.ts (localStorage)
        │ surAppel(outil, args, résultat)
        ▼
 src/main.ts (journal + surbrillance des cartes)
```

WebMCP permet à une page web de déclarer des **outils** (nom, description, schéma JSON des
paramètres, fonction `execute`) directement auprès du navigateur. Un agent qui pilote le navigateur
lit cette liste et appelle les outils, au lieu de cliquer dans l'interface ou de lire le DOM.
Tout se passe **dans la page** : aucun serveur MCP à écrire, les outils utilisent le même code
(`store.ts`) que l'interface.

### L'API utilisée

| Méthode (sur `document.modelContext`)          | Rôle                                                  | Utilisée par         |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------- |
| `registerTool(outil, { signal })`              | Déclare un outil ; `signal.abort()` le retire         | la page (`webmcp.ts`) |
| `getTools()`                                   | Liste les outils enregistrés                          | l'agent, le relais, `__webmcpTest` |
| `executeTool(outil, argsJson)`                 | Appelle un outil avec ses arguments en JSON           | l'agent, le relais, `__webmcpTest` |
| évènement `toolchange`                         | Signale que la liste d'outils a changé                | l'agent, le relais   |

`getModelContext()` renvoie `document.modelContext ?? navigator.modelContext ?? null` : l'API
native de Chrome d'abord, puis l'ancien emplacement (anciennes versions, polyfill `@mcp-b`).
Les types minimaux sont dans `src/modelcontext.d.ts`, car TypeScript ne les connaît pas encore.

### Définition d'un outil

Chaque outil de `webmcp.ts` associe une description pour l'agent et une `action` qui appelle le store :

```ts
{
  name: "deplacer_tache",
  description: "Déplace une tâche (par son id) vers une autre colonne.",
  inputSchema: { type: "object", properties: { id, colonne }, required: ["id", "colonne"] },
  action: (a) => ({ tache: deplacer(a.id, a.colonne) }),
}
```

- **`inputSchema`** est un schéma JSON : l'agent s'en sert pour construire les arguments
  (l'`enum` de `colonne` lui donne les seules valeurs valides).
- **`annotations: { readOnlyHint: true }`** (sur `lister_taches`) indique que l'outil ne modifie
  rien : l'agent peut l'appeler sans demander de confirmation.
- Au moment de l'enregistrement, `action` est enveloppée dans une fonction `execute` qui :
  1. exécute l'action ;
  2. transforme toute exception en `{ erreur: "message" }` (l'agent reçoit un message lisible,
     pas une erreur technique) et l'écrit dans la console (`[WebMCP] Échec de l'appel…`) ;
  3. prévient l'interface (`surAppel`) pour le journal et la surbrillance ;
  4. renvoie le résultat **sérialisé en JSON** (chaîne), format attendu par `executeTool`.

### Cycle de vie de l'enregistrement

1. **Démarrage** (`main.ts`) : la page attend d'abord le chargement du script du relais
   (`attendreRelais()`, 5 s au plus, grâce à l'attribut `data-etat` posé par `onload`/`onerror`
   dans `index.html`), puis vérifie que WebMCP existe.
   - Si oui, et si l'interrupteur n'a pas été coupé lors de la visite précédente (`localStorage`),
     elle appelle `activer()`.
   - Sinon, l'interrupteur est grisé, le badge affiche « WebMCP : désactivé », le journal affiche
     « WebMCP non disponible » et un bandeau explique comment activer le flag.
2. **`activer()`** : retire d'abord les outils éventuellement déjà présents, crée **un seul**
   `AbortController` pour les 4 outils, puis les enregistre un par un. Si un enregistrement échoue,
   tout est retiré et l'erreur (nom de l'outil + message) est affichée en rouge dans le journal.
3. **`desactiver()`** (interrupteur coupé) : `abort()` sur le contrôleur retire les 4 outils d'un
   coup. Pour les polyfills qui ne gèrent pas `signal`, `unregisterTool(nom)` est aussi appelé.
4. **Jamais d'outils en double** : le contrôleur est stocké sur `window.__webmcpControleur` (et non
   dans une variable du module), et `import.meta.hot.dispose(desactiver)` retire les outils quand
   Vite recharge le module. Même après un rechargement à chaud ou plusieurs clics rapides sur
   l'interrupteur, `getTools()` renvoie toujours exactement 4 outils.

### Comment les agents trouvent les outils

- **Codex (extension Chrome)** : se connecte à l'onglet via le protocole DevTools, active le domaine
  `WebMCP` (évènements `toolsAdded` / `toolsRemoved`), puis appelle `document.modelContext.getTools()`
  et `executeTool()` dans un monde JavaScript isolé. Seules les pages sécurisées (`https://`) ou
  `http://localhost` sont acceptées : c'est le cas ici.
- **Claude Desktop / Claude Code** : le script `embed.js` de `@mcp-b/webmcp-local-relay`
  (version figée à `5.1.0` dans `index.html`) lit lui aussi `getTools()`, surveille `toolchange`
  (et interroge toutes les 2 s en secours), et transmet la liste via une iframe cachée au relais
  local `127.0.0.1:9333`. Il **ne remplace pas** `document.modelContext`, il ne fait que le lire.
- **Extension « Model Context Tool Inspector »** : lit la même API.

### Tester depuis la console (développement uniquement)

```js
await window.__webmcpTest()
// [WebMCP test] getTools() : ["ajouter_tache","deplacer_tache","lister_taches","supprimer_tache"]
// [WebMCP test] executeTool(lister_taches) : { taches: [...] }
```

Cette fonction n'existe qu'avec `npm run dev` (`import.meta.env.DEV`) : elle n'est pas incluse
dans le build de production.

### Diagnostic

Tous les messages techniques sont préfixés par `[WebMCP]` dans la console :

| Message                                        | Signification                                              |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `4 outils enregistrés.`                        | Tout va bien                                               |
| `WebMCP non disponible…`                       | Flag Chrome non activé ou navigateur non compatible        |
| `Échec de l'enregistrement de « … »`           | `registerTool` a refusé l'outil (schéma, nom en double…)    |
| `Échec de l'appel de « … »`                    | L'outil a levé une erreur (id inconnu, colonne invalide…)   |
| `Le relais ne s'est pas chargé en 5 s…`        | jsDelivr injoignable : les outils restent disponibles pour Codex, pas pour Claude Desktop |

> **Codex affiche « Unable to load browser request-header policy » ?** Cette erreur ne vient pas de
> la page : avant chaque commande navigateur, Codex télécharge sa configuration depuis
> `ab.chatgpt.com` et abandonne après 10 s. Un antivirus qui analyse le HTTPS (Avast, par exemple)
> peut la ralentir : ajoutez `ab.chatgpt.com` aux exceptions, puis redémarrez Codex.

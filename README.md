# Kanban WebMCP

Un petit tableau Kanban (« À faire », « En cours », « Terminé ») qui expose des **outils WebMCP** :
un agent IA peut lister, ajouter, déplacer et supprimer des tâches directement dans la page.

- `src/webmcp.ts` : **tout** le code WebMCP (moins de 80 lignes)
- `src/store.ts` : les tâches (sauvegardées dans `localStorage`)
- `src/main.ts` : l'interface (tableau, journal de l'agent, interrupteur)

> WebMCP est **expérimental** et l'API change encore. Ce projet utilise `document.modelContext`
> (l'ancien nom `navigator.modelContext` est obsolète depuis Chrome 150).

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

## 4. Script de démo

**Avant de tourner :** cliquez sur **Réinitialiser** pour retrouver les 5 tâches d'exemple.

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

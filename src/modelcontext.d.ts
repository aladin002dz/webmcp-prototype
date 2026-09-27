// Types minimaux de l'API WebMCP, pas encore dans TypeScript.
// Chrome récent : document.modelContext. Anciennes versions et polyfill @mcp-b : navigator.modelContext.

type JsonValue = string | number | boolean | null | JsonValue[] | { [cle: string]: JsonValue };
type JsonObject = { [cle: string]: JsonValue };

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (args: JsonObject) => Promise<string>;
}

// Outil tel que renvoyé par getTools()
interface RegisteredModelContextTool {
  name: string;
  description?: string;
  inputSchema?: object | string;
  origin?: string;
}

interface ModelContext extends EventTarget {
  // Promise dans Chrome, parfois synchrone dans les polyfills
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void> | void;
  unregisterTool?(name: string): void;
  getTools?(): Promise<RegisteredModelContextTool[]>;
  executeTool?(
    tool: RegisteredModelContextTool,
    inputJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<string | null>;
}

interface Document {
  readonly modelContext?: ModelContext;
}

interface Navigator {
  readonly modelContext?: ModelContext;
}

interface Window {
  // Contrôleur partagé entre les rechargements HMR du module webmcp.ts
  __webmcpControleur?: AbortController;
  __webmcpTest?: () => Promise<void>;
}

# MCP data.gouv.fr

**URL** : https://mcp.data.gouv.fr/mcp
**GitHub** : https://github.com/datagouv/datagouv-mcp
**Date** : 2026-02-28

## Statut : NON FONCTIONNEL (bug serveur)

## Erreurs rencontrées

1. Via transport HTTP direct (`claude mcp add --transport http`) :
   `HTTP 404: Invalid OAuth error response: SyntaxError: JSON Parse error: Unexpected identifier "Not". Raw body: Not Found`
   → Claude Code tente un flow OAuth, le serveur ne l'implémente pas.

2. Via `mcp-remote` (`npx -y mcp-remote https://mcp.data.gouv.fr/mcp`) :
   `Failed to reconnect to datagouv` → échec aussi.

## Cause

Bug côté serveur — issue GitHub #25 : sessions non trouvées après initialisation (Streamable HTTP).
Le serveur ne gère pas correctement les sessions MCP.

## Ce qui a été testé

```bash
# Méthode 1 (native HTTP) — KO
claude mcp add --transport http datagouv https://mcp.data.gouv.fr/mcp

# Méthode 2 (via mcp-remote) — KO
claude mcp remove datagouv
claude mcp add datagouv -- npx -y mcp-remote https://mcp.data.gouv.fr/mcp
```

## À faire quand le serveur sera corrigé

Retenter méthode 1 ou méthode 2. Vérifier issue #25 sur GitHub.

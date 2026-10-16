# Local CORS Proxy Guide (Standalone & Local Dev)

> **Contourner les restrictions CORS en mode Standalone (GitLab Pages / Hébergement Statique)**  
> 100% local, aucune dépendance externe, zéro fuite de données vers l'extérieur.

---

## 1. Pourquoi ce proxy local ?

Lorsque l'Inspector MCP s'exécute dans un navigateur depuis une origine HTTPS publique ou distante (ex: `https://mcp-use-fork-417a01.pages.gitlab.disney.com/`) :
- **Same-Origin Policy & CORS** : Le navigateur refuse les requêtes directes vers des serveurs locaux (`https://localhost:8443`, `http://localhost:11434` pour Ollama, API OpenAI compatibles) si ces derniers ne renvoient pas les en-têtes `Access-Control-Allow-Origin` adéquats.
- **Private Network Access (PNA)** : Chrome bloque les requêtes provenant d'un contexte public vers une IP privée ou loopback (`127.0.0.1` / `localhost`) à moins que le serveur ne réponde avec `Access-Control-Allow-Private-Network: true`.
- **Filtrage d'origine côté serveur (`ALLOWED_ORIGINS`)** : Même si le serveur dispose d'une liste blanche d'origines, un proxy local supprime le header `origin` lors du transfert pour que le serveur traite la requête comme un appel interne serveur-à-serveur.

Le **Local CORS Proxy** inclus dans ce fork résout ces trois problèmes en s'exécutant sur votre machine en écoute sur `127.0.0.1:3020`.

---

## 2. Démarrage rapide

Le proxy est écrit en Node.js pur (bibliothèque standard `node:http` et `node:https`) : **aucune installation npm n'est requise**.

### Sur macOS & Linux
```bash
# Lancement avec le port par défaut (3020) :
./scripts/fork/run-cors-proxy.sh

# Lancement sur un port personnalisé :
./scripts/fork/run-cors-proxy.sh 3050
```

### Sur Windows
- **Invite de commandes (CMD) ou double-clic** :
  ```cmd
  scripts\fork\run-cors-proxy.bat
  # Port personnalisé :
  scripts\fork\run-cors-proxy.bat 3050
  ```
- **PowerShell** :
  ```powershell
  .\scripts\fork\run-cors-proxy.ps1
  # Port personnalisé :
  .\scripts\fork\run-cors-proxy.ps1 3050
  ```

---

## 3. Configuration dans l'Inspector MCP

Dans le formulaire de connexion de l'Inspector (Dashboard ou Onglet *Connection Settings*) :

1. Définissez l'**URL du serveur cible** :
   - Ex: `https://localhost:8443/mcp`
   - Ou Ollama : `http://localhost:11434`
2. Ouvrez la section **Configuration** :
   - **Connection Mode** : `Proxy` (ou `Auto`)
   - **Proxy Endpoint** : `http://localhost:3020` (ou votre port configuré)
3. Cliquez sur **Connect** ou **Save**.

Toutes les requêtes de l'Inspector transiteront alors par votre proxy local sur votre machine, qui s'occupe de relayer le trafic et d'ajouter les en-têtes CORS nécessaires.

---

## 4. Cas d'usage : Ollama en local

Si vous connectez un serveur Ollama local :

### Option A : Avec le Local CORS Proxy
Démarrez Ollama normalement, puis configurez l'Inspector avec `Proxy Endpoint: http://localhost:3020`.

### Option B : Sans proxy (en autorisant les origines dans Ollama)
Sur **macOS / Linux** (`zsh`) :
```zsh
OLLAMA_ORIGINS="*" ollama serve
```
*(Si Ollama tourne via l'application Mac dans la barre des menus : `launchctl setenv OLLAMA_ORIGINS "*"` puis quittez et relancez l'app).*

Sur **Windows** (PowerShell) :
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

---

## 5. Sécurité & Confidentialité

- **Loopback strict (`127.0.0.1`)** : Le proxy n'écoute pas sur les interfaces réseau publiques.
- **Zéro télémétrie** : Aucune donnée, URL ou payload n'est envoyé à des serveurs tiers.
- **Certificats locaux** : Le proxy autorise automatiquement les certificats auto-signés locaux (`localhost`, `127.0.0.1`, `.local`) pour simplifier le développement avec `mkcert`.

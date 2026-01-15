# Mail Gateway API - Documentation

Bienvenue dans la documentation de l'API Mail Gateway. Cette API permet d'envoyer des emails via SMTP de manière sécurisée et centralisée.

## 🔐 Authentification

Toutes les requêtes vers les endpoints protégés nécessitent une authentification via header :

-   **Header** : `x-api-key`
-   **Valeur** : Correspond à la variable d'environnement `MAIL_API_KEY` définie sur le serveur.

---

## 🚀 Endpoints

### 1. Vérification de l'état (Health Check)
Vérifie si le serveur est en ligne.

-   **URL** : `/health`
-   **Méthode** : `GET`
-   **Auth requise** : Non
-   **Réponse Succès (200)** :
    ```json
    { "ok": true }
    ```

### 2. Envoyer un email
Envoie un email en utilisant une configuration SMTP dynamique fournie dans le corps de la requête.

-   **URL** : `/send`
-   **Méthode** : `POST`
-   **Auth requise** : Oui (`x-api-key`)
-   **Headers** :
    -   `Content-Type: application/json`
    -   `x-api-key: <VOTRE_CLE>`

#### Corps de la requête (JSON)

```json
{
  "smtp": {
    "host": "smtp.example.com",     // Requis
    "port": 587,                    // Requis
    "user": "ton_user_smtp",        // Optionnel
    "pass": "ton_pass_smtp",        // Optionnel
    "secure": false                 // Optionnel (défaut: true si port 465)
  },
  "mail": {
    "from": "expediteur@example.com", // Requis
    "to": "destinataire@example.com", // Requis (peut être une liste séparée par des virgules)
    "subject": "Sujet de l'email",    // Requis
    "text": "Contenu texte brut",     // Optionnel
    "html": "<p>Contenu HTML</p>"     // Optionnel
  },
  "idempotencyKey": "unique-id-123"   // Optionnel, renvoyé dans la réponse pour suivi
}
```

#### Réponses

-   **200 OK** : Email accepté par le serveur SMTP.
    ```json
    {
      "ok": true,
      "messageId": "<...>",
      "smtpHost": "smtp.example.com"
    }
    ```
-   **400 Bad Request** : Données manquantes (SMTP ou Mail).
-   **401 Unauthorized** : Clé API manquante ou invalide.
-   **403 Forbidden** : Hôte ou port SMTP non autorisé (si allowlist active).
-   **500 Internal Server Error** : Erreur de connexion SMTP ou autre problème serveur.

---

## 🛠 Configuration Locale

Assurez-vous d'avoir un fichier `.env` à la racine :

```env
MAIL_API_KEY=votre_cle_secrete
PORT=3000
# Allowlist optionnelle
SMTP_HOST_ALLOWLIST=smtp.gmail.com,smtp.office365.com
```

---

## 🐳 Docker (Recommandé)

### Démarrer
```bash
docker compose up -d
```

### Arrêter
```bash
docker compose down
```


### Voir les logs
```bash
docker compose logs -f
```

---

## 🧪 Tester l'API (PowerShell)

Copiez-collez ce bloc dans votre terminal PowerShell pour tester l'envoi d'un mail :

```powershell
$headers = @{ "x-api-key" = "test-secret-key-123"; "Content-Type" = "application/json" }
$body = @{
    smtp = @{
        host = "smtp.example.com"
        port = 587
        user = "test_user"
        pass = "test_pass"
    }
    mail = @{
        from = "me@example.com"
        to = "you@example.com"
        subject = "Test API"
        text = "Ceci est un test"
    }
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/send" -Method Post -Headers $headers -Body $body
    Write-Host "Succès : " $response
} catch {
    # Affiche l'erreur retournée par l'API (ex: mauvais SMTP) au lieu de l'erreur PowerShell standard
    $errorJson = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorJson)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Réponse API (Erreur attendue si SMTP fictif) : $responseBody" -ForegroundColor Yellow
}

```

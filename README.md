# 🔥 Thermeo — Attestations chaudières AGW 29/01/2009

Application web de génération d'attestations de réception et contrôle périodique pour générateurs de chaleur, conformément à la réglementation wallonne (AGW du 29/01/2009).

## Déploiement sur Netlify (5 minutes)

### Étape 1 — Connecter Netlify à GitHub

1. Allez sur **[netlify.com](https://netlify.com)** → créez un compte gratuit (avec votre compte GitHub)
2. Cliquez **"Add new site"** → **"Import an existing project"**
3. Choisissez **GitHub** → autorisez l'accès → sélectionnez le repo **`thermeo-attestations`**
4. Paramètres de build :
   - **Branch** : `main`
   - **Build command** : *(laisser vide)*
   - **Publish directory** : `public`
5. Cliquez **"Deploy site"**

### Étape 2 — Configurer les variables d'environnement

Dans Netlify → votre site → **Site configuration** → **Environment variables** → **"Add a variable"** :

| Key | Value | Obligatoire |
|---|---|---|
| `APP_PASSWORD` | Un mot de passe de votre choix, à communiquer aux techniciens autorisés. Protège la génération de PDF : sans lui, l'application refuse de créer une attestation. | **Oui** |
| `RESEND_API_KEY` | Clé API [Resend](https://resend.com) (compte gratuit). Permet d'archiver automatiquement par e-mail une copie de chaque attestation générée, envoyée à `contact@thermeo.be`. Sans cette variable, l'archivage est simplement désactivé (la génération de PDF continue de fonctionner). | Non |
| `RESEND_FROM` | Adresse d'expédition des e-mails d'archivage. Par défaut `Thermeo Attestations <onboarding@resend.dev>` (fonctionne sans configuration de domaine, adapté à un usage interne à faible volume). | Non |

Après ajout des variables : **Deploys** → **"Trigger deploy"** → **"Deploy site"** pour redémarrer.

> L'identité du technicien (nom, agréation, coordonnées) est fixée en dur côté serveur (`netlify/functions/generate-pdf.js`) et ne peut pas être modifiée depuis le formulaire — cela empêche qu'une attestation usurpe le nom ou le numéro d'agréation du technicien.

### Étape 3 — Votre URL

Votre app est disponible sur :
```
https://[nom-auto].netlify.app
```

Vous pouvez personnaliser l'URL dans **Site configuration** → **Domain management** → **Options** → **Edit site name** → `thermeo-attestations` → URL devient :
```
https://thermeo-attestations.netlify.app
```

---

## Mises à jour

Pour mettre à jour l'application :
1. Remplacez les fichiers dans le repo GitHub
2. Netlify redéploie automatiquement en 30 secondes

---

## Structure du projet

```
thermeo-attestations/
├── public/
│   ├── index.html            ← Application web complète
│   └── js/
│       └── catalog.json      ← Catalogue des types d'appareils (modifiable sans toucher au code)
├── netlify/
│   └── functions/
│       ├── generate-pdf.js    ← Fonction API : authentification, routage, archivage
│       └── pdf-generator.js   ← Générateur PDF (PDFKit)
├── netlify.toml               ← Configuration Netlify
├── package.json
└── README.md
```

Pour ajouter un type d'appareil ou une marque, il suffit d'éditer `public/js/catalog.json` (aucune modification de code, aucune connaissance en programmation requise) et de pousser le changement — Netlify redéploie automatiquement.

---

## Coût estimé

- **Netlify** : gratuit (125 000 requêtes/mois)
- **Resend** (archivage e-mail, optionnel) : gratuit jusqu'à 100 e-mails/jour
- **Total** : pratiquement gratuit pour un usage professionnel normal

---

*Développé pour Thermeo — Martin Garroy TGI 467 — AGW 29/01/2009 Région wallonne*

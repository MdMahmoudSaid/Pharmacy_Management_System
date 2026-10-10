# Déploiement VPS

Installer Docker, cloner le dépôt et créer `.env` avec `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` et `AUTH_FINGERPRINT_SECRET` aléatoire (32 caractères minimum). Lancer `docker compose -f compose.production.example.yml up -d --build`; les migrations précèdent le serveur. Créer l’administrateur avec `docker compose -f compose.production.example.yml exec app pnpm create-admin`. Placer Caddy ou Nginx avec TLS devant `127.0.0.1:3000`, puis vérifier `/api/health`. Ne jamais committer `.env`.

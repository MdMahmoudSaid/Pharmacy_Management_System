# Exploitation

Sauvegarder quotidiennement avec `pg_dump -Fc`; tester mensuellement une restauration isolée avec `pg_restore`. Consulter `docker compose logs -f --tail=200 app postgres`. Avant mise à jour : sauvegarde, image/tag précédent conservé, reconstruction, contrôle santé et rapports. Pour rollback, redémarrer l’image précédente; restaurer la base seulement si la migration est incompatible. Les audits et mouvements sont append-only.

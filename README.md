# Geräte-Reservierungssystem

Multi-User Webapp zum Reservieren von Geräten und Werkzeugen. Läuft mit Docker und HTTPS (Let's Encrypt via Caddy).

## Schnellstart (Entwicklung/Lokal)

```bash
# Repository klonen und in den Ordner wechseln
cd reservierung-app

# .env-Datei erstellen
cp .env.example .env
# Passwörter in .env anpassen!

# Starten
docker compose up -d --build

# Öffne https://localhost (selbstsigniertes Zertifikat akzeptieren)
```

**Standard-Admin-Login:** `admin@example.com` / `admin123`

## Produktion (Ubuntu Server mit Domain)

### Voraussetzungen

- Ubuntu 22.04+ mit Docker und Docker Compose
- Eine Domain, die auf den Server zeigt (A-Record)
- Ports 80 und 443 offen

### Schritt-für-Schritt

1. **Docker installieren** (falls noch nicht vorhanden):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Neu einloggen
   ```

2. **App auf den Server kopieren:**
   ```bash
   scp -r reservierung-app/ user@server:/opt/reservierung-app/
   ssh user@server
   cd /opt/reservierung-app
   ```

3. **Umgebungsvariablen konfigurieren:**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Wichtige Werte setzen:
   ```env
   DB_PASSWORD=ein_sicheres_db_passwort
   JWT_SECRET=ein_langes_geheimes_jwt_secret_min_32_zeichen
   ADMIN_EMAIL=admin@meinefirma.de
   ADMIN_PASSWORD=ein_sicheres_admin_passwort
   DOMAIN=reservierung.meinefirma.de
   ```

4. **Domain in docker-compose.yml aktivieren:**

   In `docker-compose.yml` beim Caddy-Service diese Umgebungsvariablen hinzufügen:
   ```yaml
   caddy:
     environment:
       DOMAIN: reservierung.meinefirma.de
       TLS_EMAIL: admin@meinefirma.de
   ```

5. **Starten:**
   ```bash
   docker compose up -d --build
   ```

   Let's Encrypt generiert automatisch ein gültiges HTTPS-Zertifikat.

6. **Status prüfen:**
   ```bash
   docker compose ps
   docker compose logs -f caddy
   ```

## Funktionen

### Für Benutzer
- Geräte durchsuchen und filtern nach Kategorie
- Geräte mit Datum/Uhrzeit reservieren
- Eigene Reservierungen einsehen und stornieren
- Überlappungsschutz (keine Doppelbuchungen)

### Für Admins
- Benutzer anlegen, bearbeiten, deaktivieren, löschen
- Geräte anlegen, bearbeiten, sperren, löschen
- Alle Reservierungen einsehen und stornieren

## API-Endpunkte

| Methode | Pfad                          | Beschreibung                  | Auth    |
|---------|-------------------------------|-------------------------------|---------|
| POST    | /api/auth/login               | Anmelden                      | -       |
| GET     | /api/auth/me                  | Eigene Daten                  | Ja      |
| PUT     | /api/auth/password            | Passwort ändern               | Ja      |
| GET     | /api/users                    | Benutzerliste                 | Admin   |
| POST    | /api/users                    | Benutzer anlegen              | Admin   |
| PUT     | /api/users/:id                | Benutzer bearbeiten           | Admin   |
| DELETE  | /api/users/:id                | Benutzer löschen              | Admin   |
| GET     | /api/items                    | Geräteliste                   | Ja      |
| GET     | /api/items/:id                | Gerät mit Reservierungen      | Ja      |
| POST    | /api/items                    | Gerät anlegen                 | Admin   |
| PUT     | /api/items/:id                | Gerät bearbeiten              | Admin   |
| DELETE  | /api/items/:id                | Gerät löschen                 | Admin   |
| GET     | /api/reservations             | Reservierungen                | Ja      |
| GET     | /api/reservations/my          | Eigene Reservierungen         | Ja      |
| POST    | /api/reservations             | Reservierung erstellen        | Ja      |
| PUT     | /api/reservations/:id/cancel  | Reservierung stornieren       | Ja*     |
| DELETE  | /api/reservations/:id         | Reservierung löschen          | Admin   |

*Eigene oder Admin

## Architektur

```
Browser ──HTTPS──▶ Caddy ─┬──/api/*──▶ Express (Node.js) ──▶ PostgreSQL
                          └──/*──────▶ Nginx (React SPA)
```

## Backup

```bash
# Datenbank sichern
docker compose exec db pg_dump -U reservierung reservierung > backup.sql

# Wiederherstellen
docker compose exec -T db psql -U reservierung reservierung < backup.sql
```

## Updates

```bash
cd /opt/reservierung-app
git pull  # oder neue Dateien kopieren
docker compose up -d --build
```

# ROAM · Reise-Kamera als PWA

Mobile Kamera-App für Reiseclips: aufnehmen, lokal behalten, in Gruppen teilen und unveränderte Originaldateien für den späteren Schnitt exportieren.

## Funktionen

- Kamera mit Originalton, Kamerawechsel und 15-/60-Sekunden-Limit oder unbegrenzter Aufnahme.
- Lokales Clip-Archiv mit Suche, Reise- und Favoritenfilter, Sortierung und Mehrfachauswahl.
- Clip-Details mit Titel, Notizen, Datum, Uhrzeit und User.
- Optionaler GPS-Aufnahmestandort nach Gerätefreigabe, Kartenlink und Standortdaten im Export.
- ZIP-Export der unveränderten Videodaten, CSV, JSON-Metadaten und FCPXML-Rohschnitt.
- ZIP-Wiederherstellung mit Prüfsummenprüfung und Duplikatschutz.
- Papierkorb und chronologischer Reiseplayer.
- Gruppenreisen mit Einladungscode, Mitgliedschaften, privatem Online-Feed und manueller Clip-Freigabe.
- Standortfreigabe an Gruppen ist standardmäßig ausgeschaltet und muss beim Upload ausdrücklich aktiviert werden.
- Ersteinrichtung in fünf Schritten; einmalige Anzeige pro Browser/Gerät und erneut aufrufbar in den Einstellungen.
- PWA-Manifest und offline verfügbares App-Grundgerüst.

## Bereitstellung

`vercel-app/` ist eine eigenständige Next.js-App für Vercel. Im Vercel-Projekt die Root Directory auf `vercel-app`, Node.js auf 24 und Build auf `npm run build` setzen. Kamera, Dateien, Onboarding und Offline-Shell laufen dort direkt.

Gruppenreisen laufen weiterhin unter der bestehenden geschützten Sites-Adresse. Der Gruppen-Tab der Vercel-App verlinkt dorthin. Gemeinsame Originaldateien und Gruppen bleiben auf Cloudflare D1/R2 gespeichert. Eine direkte Backend-Verbindung aus Vercel ist noch nicht freigeschaltet; es wurden keine Backend-Geheimnisse auf Vercel übertragen.

Lokale Clips gehören zur jeweiligen Domain. Vor einem Wechsel ein ROAM-ZIP exportieren und in der anderen App wieder importieren. Für Änderungen an gemeinsamen Assets beide `public/`-Verzeichnisse aktualisieren; die Vercel-Fassung von `groups-ui.js` enthält den Wechsel zur Gruppen-App.

## Lokal installieren und prüfen

Voraussetzung: Node.js 24 und die im `packageManager`-Feld festgelegte pnpm-Version.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Für die lokale Gruppendatenbank nach dem ersten Build:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_worthless_ares.sql
pnpm dev
```

Die lokale Vorschau und die produktive Datenbank sind getrennt. Ohne verifizierte Anmeldung liefern geschützte Gruppen-APIs `401`. Entwicklungs-Anmeldung niemals als produktive Authentifizierung einsetzen.

## Quellstruktur

| Pfad | Inhalt |
| --- | --- |
| `public/index.html` | App-Oberfläche und Dialoge; Quelle für die HTML-Shell |
| `public/design.css` | Mobile App-Oberfläche und responsive Darstellung |
| `public/app.js` | Kamera, Archiv, Schnittdateien, ZIP, Player und Papierkorb |
| `public/groups-ui.js` | GPS-Aufnahmestandort und Gruppenoberfläche |
| `public/onboarding.js` | Ersteinrichtung und Gerätefreigaben |
| `public/sw.js` | Offline-App-Shell; Gruppen-APIs werden nicht gecacht |
| `server/groups.mjs` | Geschützte Gruppen-API, Mitgliedschaften, Quoten und Originaldateien |
| `db/schema.ts`, `drizzle/` | Datenbankschema und versionierte Migrationen |
| `app/api/groups/[[...path]]/route.ts` | Aktuelle Worker-Anbindung der API |
| `scripts/sync-shell.mjs` | Übernimmt `public/index.html` in die Server-Shell |
| `tests/` | Tests für Gruppenberechtigungen, Dateizugriff und Standortverarbeitung |

Änderungen an der Oberfläche erfolgen in `public/index.html`. Der Build synchronisiert automatisch `app/shell.ts`.

## Speicherung und Grenzen

Aufnahmen bleiben zunächst im IndexedDB-Speicher dieses Browsers. Das ist keine garantierte Datensicherung. Bei Geräteverlust oder gelöschten Browserdaten können nicht exportierte Clips verloren gehen.

Nur bewusst hochgeladene Gruppenclips werden zusätzlich online gespeichert. Aktuell maximal 25 MB pro Gruppenclip und 500 MB pro Gruppe. Ein Reisecode ersetzt bei privater Bereitstellung keine App-Zugriffsfreigabe.

Kamera- und Standortzugriff benötigen einen passenden Browser, einen sicheren Kontext und die jeweilige Gerätefreigabe. Importierte Dateien erhalten nicht automatisch den aktuellen Gerätestandort. Ihre anfängliche Datierung basiert auf der Dateiänderungszeit und kann korrigiert werden.

Der Reiseplayer verbindet Clips nur zur Wiedergabe. Die App rendert noch keinen fertigen Vlog als einzelne Videodatei. Die FCPXML-Datei ist ein vorbereiteter Rohschnitt; Medien müssen im Schnittprogramm gegebenenfalls neu verknüpft werden.

Beim Wechsel auf eine andere Domain bleiben lokale Browserdaten auf der bisherigen Domain. Vorher Originale als ROAM-ZIP exportieren und auf der neuen Domain wieder importieren. Eine neue Domain übernimmt diese Daten nicht automatisch.

## Zugangsdaten und Datenschutz

Keine Tokens, Passwörter, privaten `.env`-Dateien oder Videodaten in Git einchecken. Laufzeit-Zugangsdaten gehören in die geschützten Einstellungen des jeweiligen Hosting-Anbieters. Beim Vercel-Umzug dürfen die bisherigen Authentifizierungs-Header nicht als frei sendbare Client-Identität übernommen werden.

Datenbankmigrationen nach Anwendung nicht nachträglich verändern. Änderungen benötigen eine neue Migration.

# Geo-Kick

Standortbasiertes Fußball-Sammel- und Managementspiel für Android (MVP, Version 1).

Echtes Kicken auf realen Plätzen schaltet virtuelle Belohnungen frei, mit denen du dein
eigenes Fußballteam aufbaust und in einer simulierten Liga von Division 4 bis Division 1
aufsteigst. Komplett offline, kein Backend, kein Echtgeld.

## Features (MVP-Scope, Kapitel 7 des Konzeptdokuments)

- **Karte** mit Fußball-/Bolzplätzen in der Nähe (OpenStreetMap/Overpass, lokal gecacht);
  eigene Plätze per Long-Press auf die Karte hinzufügen
- **GPS-Check-in/Check-out** mit Coin-Belohnung: ab 5 Min. 50 Coins, linear bis
  150 Coins bei 15 Min., plus genau 1 Pack pro Session; dazu 3 zufällige
  Session-Objectives (Mini-Aufgaben, Ehrensystem, Bonus-Coins)
- **Anti-Cheat**: Geofencing bei Check-in und Check-out (100-m-Radius),
  Mock-Location-Erkennung, Pflicht-Check-out, 30 Min Cooldown pro Platz,
  Bewegungssensor-Prüfung (Kapitel 6.2: ein komplett regungsloses Gerät
  bekommt keine Belohnung)
- **Packs** mit fiktiven Spielern (Session-Pack: Bronze 59,5 % / Silber 28 % / Gold 10 % /
  Legendär 2 % / ??? 0,5 %; Shop mit Standard-, Rare- und Ultimate-Packs mit besseren
  Quoten); Vollbild-Öffnung mit Seltenheits-Animationen und Soundeffekten, Spieler
  erscheinen vom schwächsten zum besten; nach den 3 Spielern gibt jedes Pack einen
  Bonus in gleicher Höhe als Coins UND Level-up-Punkte (Session 10-25 in 5er-,
  sonst 25er-Stufen: Standard 25-100, Rare 100-200, Ultimate 200-500; hohe
  Beträge fallen seltener)
- **Level-up-Punkte**: Duplikate werden verkauft (Coins) oder in gleichwertige
  Level-up-Punkte getauscht; Punkte sind frei auf jeden Spieler ausgebbar, die
  Kosten steigen mit dessen aktuellem Rating (25/50/100/200, ab 90: 250),
  Obergrenze ist 99
- **???-Karte**: seltener als Legendär und nur ein einziges Mal ziehbar – ein
  99er-Spieler, den der Spieler selbst benennt und dessen Position er wählt
  (unverkäuflich, kommt immer in den Klub)
- **Kadermanagement**: Formationen 4-4-2 / 4-3-3 / 4-2-4, Slot-Editor, Best-XI-Button,
  Kader-Limit 30 mit Verkaufssystem
- **Liga**: 4 Divisionen, 8 Klubs, Doppelrunde (14 Spieltage), 1 Spiel alle 10 Min.,
  Taktikwahl vor Anpfiff, Minuten-Live-Ticker mit Torschützen, gelben/roten Karten
  (rote Karte = Sperre fürs nächste Spiel) und Endstatistik (xG, Schüsse,
  Ballbesitz, Ecken, Fouls, Karten, Paraden) samt Man of the Match mit Note
  bis 10; Halbzeit-Pause mit Auswechslungen auf dem Formations-Feld und
  Taktikwechsel, die wirklich auf die zweite Hälfte wirken; interaktive
  Elfmeter im Spielverlauf (selbst schießen bzw. halten) und ein
  Momentum-Balken im 5-Minuten-Takt; am Saisonende
  eine animierte Rückblick-Show (Abschlusstabelle, Auf-/Abstieg mit Prämie,
  Spieler der Saison, alle Saisonnoten); Liga-Coins (Sieg 10 / Remis 5, Captain-Boni,
  Saisonprämien je Division) und Pokal-Feier beim Meistertitel;
  Auf-/Abstieg am Saisonende
- **Captain-System**: Der gewählte Starter ist der erste Captain (wechselbar im
  Squad); Captain-Tore (+3) und -Assists (+2) geben Bonus-Coins
- **Platz-Pass**: jeder besuchte Platz wird gesammelt; Erstbesuch-Bonus,
  Abzeichen (5/10/25/50 Plätze), tägliche Check-in-Serie mit wachsendem Bonus
  und ein Heimplatz (meistbesuchter Platz: blauer Pin, Level, Bonus-Coins)
- **Platz-Kämpfe**: an jedem Platz wartet ein fiktives Gegner-Team, das man nur
  vor Ort herausfordern kann - auch während einer laufenden Session (1x pro
  Platz und Tag; Sieg = Session-Pack); der tägliche Gold-Platz wird immer im
  Umkreis der aktuellen Position gewählt; kein
  Remis - nach 90 Minuten folgt ein interaktives Elfmeterschießen (Ecke wählen
  beim Schießen UND Halten, Best-of-5 mit Sudden Death); einmal am Tag ist ein
  Platz der Gold-Platz mit starkem Boss-Team, großer Belohnung und doppelten
  Session-Coins
- **Eier**: nach Sessions gefundene Eier (1/3/5 km, bis zu 3 gleichzeitig)
  brüten durch echte GPS-Strecke aus (zählt, solange die App offen ist) und
  schlüpfen zu Spielern - längere Strecke, bessere Quoten
- **Lokale Speicherung** aller Daten in SQLite (expo-sqlite)
- **Friendlies** (optional, via Supabase): anonymes Konto, Freunde per
  6-stelligem Code, Freundschaftsspiele gegen die zuletzt synchronisierte
  Start-Elf der Freunde (kein Coin-Reward, lokale Siegbilanz); ohne
  Konfiguration/Internet laeuft die App unveraendert rein lokal

## Technischer Stack

React Native (Expo SDK 57) · TypeScript · React Navigation · Zustand · expo-sqlite ·
expo-location · MapLibre (@maplibre/maplibre-react-native) mit OSM-Raster-Tiles

Architektur: Feature-Ordner (`src/features/*`), Engine/Domain (`src/core/*`),
Repository-Schicht über SQLite (`src/core/db/repositories/*`) – so kann später ein
Backend hinter derselben Schnittstelle ergänzt werden.

## App auf dem Android-Handy testen (USB)

Voraussetzungen (einmalig):

1. **Android Studio** installieren (liefert Android SDK + Platform-Tools/adb):
   https://developer.android.com/studio
2. Auf dem Handy **Entwickleroptionen** aktivieren (Einstellungen → Über das Telefon →
   7× auf „Build-Nummer" tippen) und **USB-Debugging** einschalten.
3. Handy per USB-Kabel anschließen und die Debugging-Abfrage auf dem Handy bestätigen.
   Prüfen: `adb devices` muss das Gerät als `device` listen.

Dann im Projektordner:

```bash
npm install
npx expo run:android
```

Der erste Lauf erzeugt den nativen Android-Ordner (Prebuild), baut die Debug-APK und
installiert sie direkt auf dem angeschlossenen Handy. Das dauert beim ersten Mal
mehrere Minuten. Danach startet die App zusammen mit dem Metro-Dev-Server –
Codeänderungen erscheinen sofort per Hot Reload.

Für spätere Sessions reicht:

```bash
npx expo start
```

und die installierte Geo-Kick-App öffnen (verbindet sich mit dem Dev-Server; Handy und
PC müssen dafür im selben WLAN sein, oder weiterhin per USB mit `npx expo run:android`).

> **Hinweis Expo Go:** Die App läuft **nicht** in Expo Go, da MapLibre einen
> Development Build benötigt – deshalb `expo run:android` statt QR-Code.

### Troubleshooting Build

- **„Gradle requires JVM 17 or later"**: `JAVA_HOME` auf das von Android Studio
  mitgelieferte JDK zeigen lassen (Benutzer-Umgebungsvariable):
  `C:\Program Files\Android\Android Studio\jbr` – danach ein neues Terminal öffnen.
- **„SDK location not found"**: Umgebungsvariable `ANDROID_HOME` auf
  `%LOCALAPPDATA%\Android\Sdk` setzen (macht Expo sonst über
  `android/local.properties` selbst).

> **Hinweis Karte:** Die Karte wird mit MapLibre und OpenStreetMap-Raster-Tiles
> gerendert – komplett ohne API-Key. (Der frühere Ansatz react-native-maps + UrlTile
> scheiterte auf Android daran, dass das Google-Maps-SDK ohne gültigen API-Key gar
> nichts rendert – auch keine Tile-Overlays.)

## Entwicklung

```bash
npm run typecheck   # TypeScript-Prüfung
npm run smoke       # Engine-Smoke-Test (Belohnungen, Packs, Spielplan, Match-Sim)
```

Balancing-Werte (Coins, Cooldown, Pack-Wahrscheinlichkeiten, Simulationsparameter)
liegen gebündelt in [src/core/domain/constants.ts](src/core/domain/constants.ts).

## Rechtliches

- Kartendaten: © OpenStreetMap-Mitwirkende (ODbL) – Attribution wird in der App angezeigt.
- Alle Spieler-, Klub- und Liganamen sind frei erfunden bzw. klar abgewandelt.

## Standalone-APK (ohne Dev-Server)

Die Debug-App lädt ihren Code vom Metro-Dev-Server; ohne laufenden Server
bleibt sie beim Start hängen. Für unterwegs die Release-Variante bauen und
installieren (JS-Bundle eingebettet, läuft komplett eigenständig):

```bash
npx expo run:android --variant release
```

## Friendlies-Backend (Supabase)

Konfiguration in [src/core/config/backend.ts](src/core/config/backend.ts)
(Project-URL + anon-Key; der anon-Key ist bewusst oeffentlich, die Sicherheit
kommt von Row-Level-Security). Datenbank-Schema zum Einspielen:
[supabase/schema.sql](supabase/schema.sql). Im Dashboard muss zusaetzlich
Authentication -> Sign In / Providers -> "Anonymous sign-ins" aktiviert sein.
Ohne Konfiguration sind die Cloud-Funktionen deaktiviert.

## Noch offen (bewusst außerhalb des MVP)

- Voll-Multiplayer (gemeinsame Ligen), Pokalmodus, Monetarisierung, iOS

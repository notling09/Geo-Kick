# ⚽ Geo-Kick

Standortbasiertes Fußball-Sammel- und Managementspiel für Android (MVP, Version 1).

Echtes Kicken auf realen Plätzen schaltet virtuelle Belohnungen frei, mit denen du dein
eigenes Fußballteam aufbaust und in einer simulierten Liga von Division 4 bis Division 1
aufsteigst. Komplett offline, kein Backend, kein Echtgeld.

## Features (MVP-Scope, Kapitel 7 des Konzeptdokuments)

- 🗺️ **Karte** mit Fußball-/Bolzplätzen in der Nähe (OpenStreetMap/Overpass, lokal gecacht);
  eigene Plätze per Long-Press auf die Karte hinzufügen
- 📍 **GPS-Check-in/Check-out** mit Coin-Belohnung: ab 5 Min. 50 Coins, linear bis
  150 Coins bei 15 Min., plus genau 1 Pack pro Session
- 🛡️ **Anti-Cheat**: Geofencing (75-m-Radius), Mock-Location-Erkennung, Pflicht-Check-out,
  2,5 h Cooldown pro Platz
- 🎁 **Packs** mit fiktiven Spielern (Bronze 60 % / Silber 28 % / Gold 10 % / Legendär 2 %);
  Duplikate trainieren Spieler (+1 Level)
- 👥 **Kadermanagement**: Formationen 4-4-2 / 4-3-3 / 5-3-2, Slot-Editor, Auto-Aufstellung
- 🏆 **Liga**: 4 Divisionen, 8 Klubs, Doppelrunde (14 Spieltage), 1 Spiel pro Stunde,
  Taktikwahl vor Anpfiff, Minuten-Live-Ticker, Auf-/Abstieg am Saisonende
- 💾 **Lokale Speicherung** aller Daten in SQLite (expo-sqlite)

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

## Noch offen (bewusst außerhalb des MVP)

- App-Icon & Logo (werden separat gestaltet; Platzhalter: ⚽-Emoji)
- Multiplayer/Freunde, Pokalmodus, Monetarisierung, Sensor-Anti-Cheat, iOS

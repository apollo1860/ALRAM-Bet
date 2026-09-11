# ALRAM Bet 🏓

Sportwetten-App für ein Hobby-Tischtennisturnier: 2 Gruppen à 5 Spieler
(Round Robin), die besten 4 pro Gruppe kommen in ein Single-K.O.-Bracket
(1A-4B, 3A-2B, 1B-4A, 3B-2A, Gruppensieger treffen sich frühestens im
Finale). Vor dem Turnier hinterlegte Gesamtsieg-Quoten bestimmen die
Ausgangsstärke jedes Spielers; die Quoten für einzelne Spiele werden
daraus berechnet und passen sich nach jedem Ergebnis automatisch an
(Sieg/Niederlage im Turnierverlauf = Form).

Wetten laufen als dynamischer Pari-Mutuel-Markt: Einsätze fließen in
einen Pool pro Seite, die Auszahlungsquote bewegt sich live mit dem
Wettverhalten und wird beim Spielende aus dem finalen Pool berechnet.

## Aktueller Stand

Alles läuft aktuell **auf einem Gerät**: Ein Dropdown oben in der App
wechselt die "aktive Identität" zwischen Admin (Setup, Ergebnisse
eintragen, Turnier steuern) und den einzelnen Spielern (Guthaben
einzahlen, wetten, eigene Wetten einsehen) – so lässt sich der ganze
Ablauf inkl. Quotenberechnung solo durchtesten. Der Zustand wird per
`localStorage` gespeichert und übersteht ein Schließen des Browsers.

Geplant: Anbindung an Firebase, damit mehrere Personen im selben
"Raum" gleichzeitig zugreifen und wetten können.

## Entwicklung

```bash
npm install
npm run dev
```

```bash
npm run build   # Typecheck + Produktionsbuild
```

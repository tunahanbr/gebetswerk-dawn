# Rechtstexte für Gebetswerk — Entwürfe (österreichisches Recht)

**Stand: Juli 2026 — KI-generierte Entwürfe für einen ÖSTERREICHISCHEN Shop (ECG, FAGG, DSG, KSchG, ABGB), vor Veröffentlichung selbst prüfen!**

> Diese Fassung wurde von deutschem Recht (BGB/DDG) auf **österreichisches Recht** umgestellt,
> weil der Shop in Österreich betrieben wird (WKO). Wenn ihr überwiegend nach Deutschland
> verkauft, lasst die Jurisdiktion von einer Anwältin/einem Anwalt gegenprüfen.

## So fügst du sie ein

Shopify-Admin → **Einstellungen → Richtlinien** ("Policies"). Dort gibt es je ein Feld:

| Datei | Shopify-Feld | URL im Shop |
|---|---|---|
| `agb.md` | Allgemeine Geschäftsbedingungen | `/policies/terms-of-service` |
| `widerrufsbelehrung.md` | Rückgabe- und Erstattungsrichtlinie | `/policies/refund-policy` |
| `datenschutzerklaerung.md` | Datenschutzerklärung | `/policies/privacy-policy` |
| `impressum.md` | Impressum / Rechtliche Hinweise | `/policies/legal-notice` |
| `versandrichtlinie.md` | Versandrichtlinie | `/policies/shipping-policy` |

Für die Shopify-Richtlinie liegt zusätzlich `widerrufsbelehrung-shopify.html`
als formatierte Rich-Text-Version vor. Den HTML-Inhalt kannst du im Rich-Text-/HTML-
Editor der Richtlinie einfügen; die Platzhalter müssen vorher ersetzt werden.

Die Footer-Links des Themes zeigen bereits auf diese URLs — sobald die Felder
befüllt sind, funktioniert alles automatisch.

## Ausfüllbares Widerrufsformular (eigene Seite)

Zusätzlich zur Widerrufsbelehrung gibt es eine eigene Seite mit dem gesetzlichen,
ausfüll- und druckbaren Muster-Widerrufsformular:

1. Shopify-Admin → **Onlineshop → Seiten → Seite hinzufügen**, Titel exakt **„Vertrag widerrufen“**.
2. Rechts unter **Theme-Vorlage** die Vorlage **`widerruf`** auswählen (Datei `templates/page.widerruf.json`).
3. Im **Theme-Editor** dieser Seite die Firmendaten (Empfänger) im Abschnitt „Widerrufsformular“ eintragen.
4. URL/Handle auf `/pages/vertrag-widerrufen` setzen — darauf verweist die Widerrufsbelehrung.

Das Online-Formular verwendet Shopifys natives Kontaktformular. Die Nachrichten
gehen an **Einstellungen → Benachrichtigungen → Absender-E-Mail**. Diese Adresse
vor dem Livegang prüfen und die Domain möglichst authentifizieren. Shopify sendet
über das native Formular keine automatische Kopie an die Kundin bzw. den Kunden;
den Eingang daher manuell oder über eine geeignete Shopify-Automation bestätigen.

## Kontaktseite

`templates/page.contact.json` ist vorbereitet. Im Admin eine Seite „Kontakt“ anlegen
und die Vorlage **`contact`** zuweisen → erreichbar unter `/pages/contact`.

## Genutzte Auftragsverarbeiter (in der Datenschutzerklärung enthalten)

Shopify (Shop/Bestellungen), Shopify Payments (Zahlung), Notion (Bestellverwaltung),
Google Workspace inkl. Apps Script (Kommunikation/Automatisierung), Sendcloud (Versand).
Für jeden dieser Dienste solltet ihr einen Auftragsverarbeitungsvertrag (AV-Vertrag) abgeschlossen haben.

## Vor dem Veröffentlichen

1. **Alle `[PLATZHALTER]` ersetzen** — Firmendaten, E-Mail, USt-IdNr. usw.
2. **Optionale Blöcke** sind mit `[FALLS ZUTREFFEND: …]` markiert — übernehmen
   oder komplett löschen, nichts halb stehen lassen.
3. **Zahlen angleichen:** Versandkosten/Gratisgrenze müssen mit den echten
   Versandtarifen (Einstellungen → Versand), dem Theme-Text auf der
   Produktseite und der Länder-Liste im Theme übereinstimmen.
4. **Zahlarten prüfen:** In der Datenschutzerklärung nur die Zahlungsanbieter
   stehen lassen, die ihr wirklich aktiviert habt.

## Wichtige inhaltliche Entscheidungen (bereits eingearbeitet)

- **Personalisierte Teppiche sind vom Rücktritt ausgeschlossen**
  (§ 18 Abs. 1 Z 3 FAGG) — das steht so auch schon im
  Produktseiten-Accordion des Themes. Nicht personalisierte Artikel
  (z. B. Gebetskette ohne Teppich, Teppich ohne Namen) bleiben widerrufbar.
- **Kein Link zur EU-ODR-Plattform** — die Plattform wurde im Juli 2025
  eingestellt; der früher übliche Pflichtlink wäre heute falsch.
- Impressum nach **§ 5 DDG** (löste 2024 das TMG ab) und § 18 Abs. 2 MStV.

## Ehrlicher Hinweis

Diese Entwürfe sind sorgfältig erstellt, aber keine Rechtsberatung. Gerade
Widerrufsbelehrung und Datenschutzerklärung sind die häufigsten
Abmahngründe im deutschen E-Commerce. Ein Abo bei IT-Recht Kanzlei oder
eRecht24 (~10–20 €/Monat, mit Haftungsübernahme und automatischen Updates
bei Gesetzesänderungen) bleibt die sicherste Lösung — diese Entwürfe sind
eine solide Grundlage bis dahin.

# Strukturierte Daten: Analyse, Korrekturen und Freigabe

Stand: 14.10.2026. Änderungen ausschließlich lokal; kein Theme-Upload, keine Veröffentlichung und keine Änderung in Shopify Admin, Judge.me oder Merchant Center.

## 1. Nachgewiesene Ursachen

Untersucht wurden alle Liquid-, JSON- und JavaScript-Dateien auf JSON-LD, Microdata/RDFa, Schema-Typen, `structured_data`, Bewertungsanbieter und dynamische Script-Erzeugung. Es gibt kein `sections/main-product.liquid`; `templates/product.json` verwendet `sections/gebetswerk-main-product.liquid`.

| Meldung | Befund vor Änderung | Behandlung |
| --- | --- | --- |
| Rezension hat mehrere zusammengefasste Bewertungen; auch unter `review` und `aggregateRating` | Live liefern Theme und Judge.me je ein anonymes `AggregateRating` für dieselbe Produktentität. Theme-ID `https://gebetswerk.com/products/gebetsteppich#product`, App-ID `/products/gebetsteppich#product`: nach URL-Auflösung identisch. Beide melden 5/5 bei 28 Bewertungen. Google führt die Produktangaben zusammen, aber erhält zwei Aggregate. | Theme gibt standardmäßig keine zusätzliche Gesamtbewertung aus. Produkt, Angebot und sichtbare Bewertungen bleiben erhalten. Optionaler Theme-Bewertungsmodus nur nach Quellenprüfung und Abschalten des App-Schemas. |
| Fehler innerhalb einzelner Rezensionen | Die 28 live gefundenen Judge.me-Reviews verwenden jeweils **ein** `reviewRating` vom Typ `Rating`. Keine verschachtelten Aggregate im Review und keine doppelten JSON-Objektschlüssel gefunden. | Keine unbegründete Umschreibung der einzelnen App-Reviews. Der gemeinsame Produktknoten erklärt die kaskadierenden Google-Meldungen. |
| Ungültiges `returnFees` | `ReturnShippingFeesCustomerResponsibility` existiert nicht als unterstützter Wert. Außerdem wurden pauschal 14 Tage und nur das Shop-Sitzland ausgegeben. | Für ausdrücklich als nicht personalisiert klassifizierte Angebote: `ReturnFeesCustomerResponsibility`, 14 Tage, AT/DE. Für ausschließlich personalisierte Angebote: `MerchantReturnNotPermitted`, ohne Gebühren/Frist. Bei gemischter/ungeklärter Personalisierung keine pauschale Richtlinie. |
| `shippingDetails` fehlt | Das bisherige Theme gibt keine Versanddaten aus. | Für physische EUR-Angebote AT/DE jeweils `OfferShippingDetails` mit `shippingRate.maxValue: 4.99`. Keine pauschale Versandkostenfreiheit, keine erfundenen anderen Länder oder umgerechneten Tarife. |
| `validFrom` fehlt | Keine Angebotsstartdaten vorhanden. Das Theme erfand stattdessen `priceValidUntil` als 31.12. des Folgejahres, selbst ohne Rabatt. Die fünf öffentlichen Varianten haben aktuell keinen Vergleichspreis. | Künstliches Enddatum entfernt. Echte typisierte Varianten-Metafelder werden nur bei aktivem Rabatt und plausibler aktueller Zeitspanne ausgegeben. Ohne echte Daten werden mögliche optionale Datumswarnungen akzeptiert; im neuen Code-Test erschien keine `validFrom`-Warnung. |

Der [Live Rich Results Test vor Veröffentlichung](https://search.google.com/test/rich-results/result?id=agnDarnRZDWL7257o04lsg) meldete **33 Einträge: 30 ungültige Rezensions-Einträge, einen gültigen Produkt-Eintrag, einen gültigen Händler-Eintrag und gültige Breadcrumbs**. Der aufgeklappte Produktknoten zeigte ausdrücklich „Review has multiple aggregate ratings“. Das bestätigt die Ursache über die reine Codeanalyse hinaus. Google-Testlinks können ablaufen.

## 2. Vollständiges Inventar und App-Grenzen

| Stelle | Ausgabe / Rolle |
| --- | --- |
| `layout/theme.liquid` | Canonical aus Shopify; `content_for_header` als möglicher externer App-Einstieg; kein eigenes Product-JSON-LD. Versteckte Add-on-Produkte werden per `noindex`/Redirect behandelt. |
| `templates/product.json` | Ein Hauptprodukt-Abschnitt, ein Judge.me-Review-App-Block mit `real_data`, außerdem FAQ. Kein zweiter Theme-Produktabschnitt. |
| `sections/gebetswerk-main-product.liquid` | Breadcrumbs und bisher Product/Offer/AggregateRating. Nun ein Render-Aufruf des neuen Produkt-Snippets. |
| `sections/gebetswerk-reviews.liquid` | Rendert den externen App-Block. Unverändert. |
| `config/settings_data.json` | Judge.me-Core-App-Embed vorhanden. Unverändert. |
| `snippets/gw-rating-stars.liquid`, Produktkarten, Produktabschnitt | Sichtbare Sterne aus `reviews.rating` / `reviews.rating_count`. Kein zusätzliches Microdata. Unverändert. |
| `sections/header.liquid` | Organization auf allen Seiten, WebSite auf Startseite. Organization-ID und Website-URL vereinheitlicht. |
| `sections/gebetswerk-faq.liquid` | FAQPage aus sichtbaren Fragen/Antworten. Kein Bewertungsfehler. Google-FAQ-Rich-Results sind für einen gewöhnlichen Shop nicht generell verfügbar; Markup allein garantiert keine Darstellung. |
| `sections/main-article.liquid` | `article \| structured_data`. Kein Product-Filter im Repository. |
| JavaScript | Keine zusätzliche Schema-Erzeugung gefunden. Generische Script-Ausführung in Dawn-Hilfsfunktionen ist kein Beleg für ein weiteres Produktschema. Produkt-JS setzt dynamische sichtbare Preise; dessen Euro-Festlegung wurde korrigiert. |
| Live-Judge.me | `<script class="jdgm-server-jld" type="application/ld+json">` liefert Product, AggregateRating und 28 Reviews. `disable_json_ld: false`, `remove_microdata_snippet: true`; kein Live-`itemprop` gefunden. |

Live wurden fünf JSON-LD-Blöcke gefunden: Organization, BreadcrumbList, Theme-Product, App-Product, FAQPage. Zwei Definitionen derselben Entität sind nicht automatisch ein Fehler: hier ist der konkrete Fehler die doppelte **Gesamtbewertung**, nicht die bloße Zahl der Script-Tags.

**Zusätzliches Problem: Bewertungsherkunft.** Die Live-App-Ausgabe enthält unter anderem Autorenbezeichnungen „Etsy customer“ und Review-Bilder mit Etsy-typischen Dateinamen. Das ist ein konkreter Hinweis auf importierte Bewertungen; die Herkunft sämtlicher 28 Bewertungen kann aus dem Theme nicht verlässlich ermittelt werden. Google untersagt das Aggregieren von Bewertungen anderer Websites. Die beiden Shopify-Standardmetafelder enthalten weder Herkunft noch eine getrennte, zulässige Teilmenge. Deshalb werden daraus standardmäßig keine Theme-Aggregate mehr erzeugt. Keine Zahlen wurden abgeleitet, geschätzt oder manuell korrigiert.

Die Quelle liegt in App-Einstellungen und App-Daten. Ein Theme kann weder den vollständigen App-Quellcode noch Herkunftsfilter kontrollieren. Die sichtbaren App-Reviews und das App-Embed wurden nicht entfernt. Auch `content_for_header` wird nicht manipuliert. Eine JavaScript-Nachbearbeitung zum Löschen externer JSON-LD-Scripts wäre für Crawler unzuverlässig und wurde nicht eingebaut.

## 3. Änderungen

| Datei | Anpassung |
| --- | --- |
| `snippets/gw-product-schema.liquid` (neu) | Zentraler Product-/Offer-Generator; überprüfbare Metafield-Verträge; keine ungeprüften Ratings, Fristen oder Rückgabepauschalen; AT/DE-Maximalversand; aktive Währung; eindeutige variantenspezifische Offer-URL/ID; vollständige Beschreibung; tatsächlicher Vendor als Brand; ausgewähltes Variantenbild zuerst; keine leeren SKU-/Bildwerte; script-sichere JSON-Ausgabe. |
| `snippets/gw-schema-gtin.liquid` (neu) | GTIN-8/12/13/14 nur bei Ziffern, zulässiger Länge und passender Prüfziffer; führende Nullen bleiben erhalten; Nullfolgen verworfen. Keine automatische SKU→MPN-Erfindung. Prüfziffer bestätigt nicht die tatsächliche GS1-Zuteilung. |
| `sections/gebetswerk-main-product.liquid` | Ersetzt alten Schema-Block durch Render; Breadcrumb-URLs nutzen aktuellen Origin/Canonical und JSON-Escapes; übergibt aktuelle Währung/Sprache an Produkt-JS. |
| `sections/header.liquid` | HTTPS-Schema-Kontext, stabile `/#organization`-ID für den Seller-Verweis, Homepage-URL anstelle wechselnder Seiten-URL. |
| `assets/gebetswerk-product.js` | `Intl.NumberFormat` mit Shopify-Presentment-Währung; Initialisierung bevorzugt serverseitig aktive Variante anstelle blind der ersten, damit Bestand/Preis und initiales Schema übereinstimmen. Warenkorb- und Add-on-Berechnung unverändert. |
| `snippets/meta-tags.liquid` | Open-Graph-Preis aus ausgewählter Variante mit numerischem Dezimalpunkt statt lokalisiertem Mindestpreis. |
| `tests/structured-data.test.cjs` (neu) | Render- und Semantiktests gegen den tatsächlichen Liquid-Snippet-Code; Fixtures sind synthetisch und werden nicht veröffentlicht. |

Die bei Arbeitsbeginn bereits vorhandene Änderung in `config/settings_schema.json` wurde nicht verändert.

**Variantenentscheidung:** Das bestehende Modell bleibt ein Product pro Produktseite mit dem serverseitig ausgewählten Angebot. Alle fünf `?variant=`-Fälle wurden geprüft. Shopify liefert die Werte bereits in Presentment-Währung und in Hundertsteln; auch bei JPY ist die Division durch 100 gemäß Shopify erforderlich. Der Grundpreis umfasst die verkaufbare Basisvariante; Personalisierung, Schleife und Express sind separate optionale Warenkorbpositionen. Ein individueller Warenkorbgesamtpreis ist kein dauerhaftes Produktangebot. Beim rein clientseitigen Farbwechsel wird das serverseitige JSON-LD nicht neu erzeugt; der abschließende Browsertest muss die direkt aufrufbaren Varianten-URLs prüfen.

Ein zusätzlicher ProductGroup-Block oder paralleler `product | structured_data`-Filter wurde bewusst nicht ergänzt. Google empfiehlt ProductGroup zur umfassenden Gruppierung von Varianten, aber ein einzelnes korrektes Product/Offer bleibt zulässig. Ein solcher Ausbau müsste zusammen mit der Judge.me-Entitätszuordnung erfolgen; sonst entstehen weitere widersprüchliche Identitäten. Die native Shopify-Ausgabe kann je nach Varianten ProductGroup erzeugen und ist kein ungeprüfter Ersatz für die bestehende App-Integration.

## 4. Versand und Rückgaben: verifizierte Quellen und offene Daten

- Die öffentliche [Versandseite](https://gebetswerk.com/pages/versand-retouren) nennt AT/DE, 4,99 EUR, kostenlos **über** 80 EUR, Transportzeiten AT 1–2 und DE 2–3 Werktage.
- Header, FAQ und Produkt-Accordion nennen kostenlos **ab** 80 EUR. Deshalb wird die exakte Schwelle nicht als maschinenlesbare Bedingung festgeschrieben.
- Die Länderauswahl enthält zahlreiche EU-Märkte sowie DKK/PLN/SEK/CZK/HUF/RON, während FAQ/Versandtext nur AT/DE nennen. Freigeschaltete Märkte beweisen keine tatsächlich verfügbare Versandzone.
- Bearbeitungszeiten hängen an Personalisierung und Express. Textwerte und konfigurierter Lieferzeitrechner stimmen nicht vollständig überein. Es werden keine Gesamtlieferzeiten erfunden.
- Die [Widerrufsrichtlinie](https://gebetswerk.com/policies/refund-policy) unterscheidet personalisierte Ware (ausgenommen) und nicht personalisierte Ware (14 Tage; Kunde organisiert/bezahlt Rücksendung). Die Versandseite beschreibt dagegen pauschal personalisierte Einzelanfertigungen. Diese Texte müssen angeglichen werden.
- Der Personalisierungsschalter liegt im Browser und ist keine persistente Shopify-Variante. Produktname oder eingeschalteter Schalter rechtfertigen daher keine allgemeine `MerchantReturnNotPermitted`-Behauptung für alle Käufe.

`shippingRate.maxValue` ist von Google ausdrücklich unterstützt. Es drückt hier nur den belegten Höchstpreis aus; kostenloser Versand bleibt in der tatsächlichen Checkout-Logik. Die vollständige Staffel gehört nach Abgleich in Merchant Center oder in eine zentrale Organization/ShippingService-Richtlinie. Eine solche Staffel wurde wegen der widersprüchlichen Daten noch nicht veröffentlicht. Neue Länder und Währungen erhalten keine pauschal übernommenen EUR-Werte.

## 5. Notwendige Admin-Schritte

1. **Judge.me → Settings → Google, SEO and AI → SEO Rich Snippets:** Herkunft der Bewertungen und tatsächlich exportierten Datensätze prüfen. Solange Etsy-/andere Fremdseitenbewertungen in der Gesamtbewertung enthalten sind, sowohl **Add JSON-LD snippets** als auch **Add microdata snippets** ausschalten. Review Widget und App-Embed aktiv lassen; sichtbare Kundenbewertungen bleiben erhalten. Der AI-visibility-Schalter ist laut Judge.me kein Ersatz für diese Schema-Einstellungen. Anschließend kontrollieren, ob `jdgm-server-jld` und dynamisch erzeugte Aggregate tatsächlich verschwunden sind. Falls nicht: Judge.me-Support muss die App-Ausgabe korrigieren. Es wurde kein Supportkontakt gesendet.
2. **Genau einen Bewertungs-Herausgeber wählen.** Wenn die App eine ausschließlich zulässige, sichtbare und produktspezifische Teilmenge korrekt exportieren kann, darf sie allein die Bewertungsdaten ausgeben; Theme-Schalter bleibt aus. Andernfalls App-Schema aus und zunächst ohne Bewertungsmarkup arbeiten. Theme-Ausgabe nur aktivieren, wenn die unten genannten Standardmetafelder exakt die zulässigen, sichtbaren Daten enthalten. Ein bloßes Bestätigungsfeld filtert keine importierten Bewertungen!
3. **Einstellungen → Benutzerdefinierte Daten:** Die optionalen Metafelder unten definieren, wenn sie tatsächlich gepflegt werden können. Bestehende App-Rating-Metafelder nicht manuell überschreiben. Ohne entsprechende bestätigte Daten die optionalen Felder leer lassen.
4. **Versand und Zustellung / Märkte:** Tatsächliche Zonen, Profile, Versandtarife, Währungen, Freigrenze (insbesondere exakt 80 EUR), Rabattbehandlung und Bearbeitungszeiten mit Checkout, Produktseite und Merchant Center abgleichen. Bei Änderung der belegten AT/DE-Maximalgebühr den zentralen Schema-Snippet aktualisieren.
5. **Richtlinien/Seiten:** Rückgabetexte vereinheitlichen. Gemischte Personalisierung nicht pauschal klassifizieren. Falls getrennte, eindeutig kaufbare Angebote benötigt werden, diese zuerst korrekt im Produktmodell abbilden.

### Optionale Metafield-Verträge

| Owner | Namespace/Key | Typ | Verwendung und Voraussetzung |
| --- | --- | --- | --- |
| Produkt | `seo.theme_rating_enabled` | Boolean | Standard leer/false. Nur true, wenn App-Schema deaktiviert, alle enthaltenen Bewertungen zulässig und exakt diese Gesamtbewertung samt zugrunde liegenden Bewertungen sichtbar sind. |
| Produkt | `reviews.rating` | Shopify Rating | Bestehender App-Wert mit `rating`, `scale_min`, `scale_max`. Nur bei vollständiger gültiger Skala ausgeben. |
| Produkt | `reviews.rating_count` | Integer | Bestehende positive ganze Zahl. Ausgabe als `ratingCount`, weil das Feld eine Anzahl von Ratings ist, keine belegte Anzahl von Textrezensionen. |
| Produkt oder Variante | `seo.return_policy` | Einzeiliger Text mit erlaubten Werten | `non_personalized`, `personalized`, `mixed`. Variantenwert hat Vorrang; `mixed`/leer/unbekannt erzeugt keine pauschale Richtlinie. Nur verwenden, wenn die gesamte konkrete Kaufoption darunter fällt. Das derzeit optional personalisierbare Hauptprodukt bleibt leer oder `mixed`. |
| Variante | `seo.sale_starts_at` | Datum und Uhrzeit (`date_time`) | Tatsächlicher Beginn des aktuell in `price` enthaltenen Rabatts. Keine Erstellungs-/Publikationsdaten verwenden. |
| Variante | `seo.sale_ends_at` | Datum und Uhrzeit (`date_time`) | Tatsächlich bekanntes Ende. Ohne Ende nur `validFrom`; keine erfundenen Folgejahresdaten. |

Die Datumsfelder verändern keine Shopify-Preise. Sie beschreiben einen bereits im Shop aktiven Rabatt (`compare_at_price > price`). Zukünftige, abgelaufene, rückwärts gerichtete oder falsch typisierte Zeiträume werden nicht ausgegeben. Metafelder wurden lokal unterstützt, aber nicht im Shopify-Admin angelegt.

## 6. Tests und Grenzen

- `shopify theme check --output json`, Shopify CLI 4.4.0: vor und nach Änderung `[]`, keine gemeldeten Fehler/Warnungen.
- `node --test tests/structured-data.test.cjs` mit LiquidJS 10: **12 Tests bestanden**. Fälle: keine Reviews; App allein; explizit freigegebene Ratings; ungültige/fehlende Werte; Skalen; reine Personalisierung; nicht personalisierte/mischbare Angebote; AT/DE; EUR/DKK/PLN/JPY; virtuelle Produkte; 80-EUR-Grenze; ausgewählte/ausverkaufte Varianten; Rabatt/Normalpreis; echte, fehlende, zukünftige und abgelaufene Zeiträume; GTIN-Prüfziffern; JSON-Escapes und `</script>`; fehlende Bilder/SKUs; JS-Währungsformatierung.
- Lokales Rendering mit öffentlich abgerufenen Produktdaten: alle fünf Varianten (Weiß, Schwarz, Hellgrau, Grün, Silber), jeweils korrekte ID/SKU, 24,90 EUR und verfügbare Angebote. Das öffentliche Produkt-Listing enthielt ein Produkt; andere reale Produktfälle waren darüber nicht verfügbar und wurden synthetisch geprüft.
- Strikter JSON-Parser auf den fünf Live-JSON-LD-Blöcken: keine doppelten JSON-Schlüssel. 28 einzelne Reviews mit `Rating`. URL-normalisiert zwei Aggregate derselben Produkt-ID vor Änderung.
- Simulation mit dem neuen Theme-Snippet und **unveränderter** Live-App-Ausgabe: weiterhin fünf Blöcke und 28 einzelne Reviews, aber nur noch **ein** Aggregate derselben Produkt-ID. Das bestätigt die technische Entkopplung; es bestätigt nicht die Zulässigkeit importierter App-Bewertungen.
- [Google-Code-Test des lokal gerenderten neuen Product-/Offer-Fragments](https://search.google.com/test/rich-results/result?id=m90OIvjKmV6vP2LbDi2AIA): **zwei gültige Einträge** (Produkt und Händler), keine kritischen Fehler, optionale Warnungen. Getestet wurde das neue Fragment mit echten öffentlichen Produktdaten, ohne App-Bewertungsblock und ohne ungeprüfte Rückgaberichtlinie. Kein Test einer veröffentlichten Änderung. Die konkreten verbleibenden Warnungen waren beim Product `aggregateRating` und `review`, beim Merchant Listing `hasMerchantReturnPolicy` sowie zweimal `deliveryTime` (AT und DE). `shippingRate.maxValue: 4.99` wurde akzeptiert.
- `node --check assets/gebetswerk-product.js` und `git diff --check`: bestanden.

LiquidJS bildet Shopify-spezifische Objekte/Filter in den Tests nach (`image_url` und `json` werden gestubbt); es ist kein Shopify-Server. `theme check` ersetzt keinen Storefront-/Checkout-Test. Kein angemeldeter Shopify-Preview-, Admin-, Checkout- oder Search-Console-Zugriff wurde genutzt. Deshalb keine Behauptung, dass alle Search-Console-Fehler bereits verschwunden sind.

Reproduzierbare lokale Tests, ohne neue Abhängigkeiten im Theme selbst:

```sh
npm install --prefix /tmp/gebetswerk-seo-tests liquidjs@10 --no-audit --no-fund
NODE_PATH=/tmp/gebetswerk-seo-tests/node_modules node --test tests/structured-data.test.cjs
shopify theme check --output json
node --check assets/gebetswerk-product.js
git diff --check
```

## 7. Abschließende Freigabe und Google-Validierung

1. Änderungen in einem unveröffentlichten Theme prüfen. Kein Live-Push ohne ausdrückliche Freigabe.
2. Judge.me-Quellen-/Schema-Einstellungen nach Abschnitt 5 bereinigen. Vor und nach JavaScript-Ausführung alle `application/ld+json`-Blöcke, Microdata und relative/absolute IDs prüfen. Pro Produktentität höchstens ein zulässiges Gesamt-Rating.
3. Shop-Vorschau: alle fünf Varianten-URLs, verfügbare/ausverkaufte Variante, Personalisierung an/aus, Aufpreise, Menge, Warenkorb und Checkout prüfen. EUR sowie unterstützte weitere Märkte testen. Schema-Preis ist der kaufbare Basisartikel, Add-on-Preise müssen separat im UI/Checkout nachvollziehbar sein.
4. Gerenderten vollständigen HTML-Code im [Rich Results Test](https://search.google.com/test/rich-results) prüfen. Nach freigegebener Veröffentlichung denselben Test als URL-Test wiederholen, inklusive Varianten und Märkten. Optionale Warnungen ohne echte Daten akzeptieren; keine Werte erfinden.
5. In Search Console je betroffener Produkt-URL **URL-Prüfung → Live-URL testen → Getestete Seite/HTML** prüfen. Nach erfolgreichem Test Indexierung beantragen.
6. In den Berichten **Rezensions-Snippets**, **Händlereinträge** und **Produkt-Snippets** jeweils **Fehlerbehebung überprüfen** starten. Letzten Crawl und betroffene URL-Beispiele beachten. Die Berichte aktualisieren sich erst nach erneuter Verarbeitung; ein erfolgreicher Live-Test löscht alte Berichtsstände nicht sofort.

## Quellen

- [Google: Review Snippets, insbesondere Quellen und Zuordnung](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Google: Merchant Listings, Versand-Maximalpreise, Rücksendekosten und Angebotszeiträume](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Google: Product Snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google: Rückgaberichtlinien](https://developers.google.com/search/docs/appearance/structured-data/return-policy)
- [Google: Produktvarianten](https://developers.google.com/search/docs/appearance/structured-data/product-variants)
- [Shopify: structured_data](https://shopify.dev/docs/api/liquid/filters/structured_data)
- [Shopify: Varianten und Presentment-Preise](https://shopify.dev/docs/api/liquid/objects/variant)
- [Judge.me: aktuelle Rich-Snippet-Einstellungen](https://judge.me/help/en/articles/8409296-displaying-product-ratings-in-google-search-results)
- [Judge.me: serverseitige AI-/Review-Ausgabe](https://judge.me/help/en/articles/15860924-making-reviews-visible-to-ai-shopping-assistants)

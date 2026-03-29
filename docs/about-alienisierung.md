# Alienizer — About

---

## DE

**Alienizer** ist ein Werkzeug zur Zeichensubstitution: Es ersetzt lateinische Buchstaben durch Zeichen aus anderen Schriftsystemen – je nach Einstellung kaum merklich oder deutlich erkennbar

### Was passiert

Das lateinische Alphabet teilt seine Formen mit vielen anderen Schriften. Ein kyrillisches „а" (U+0430) und ein lateinisches „a" sehen identisch aus – sind aber zwei verschiedene Zeichen aus zwei verschiedenen Kulturen. Ein griechisches „ο", ein armenisches "ο" sind sich sehr ähnlich, ein georgisches "ო" sieht schon etwas anders aus. Und natürlich gibt es Zeichen wie das Devanagari-म, das Äthiopische ም oder das Adlam-𞤃, die alle den gleichen Laut tragen aber visuell völlig verschiedene Dimensionen besitzeh.

 Alienizer nutzt diesen Spielraum der Schrift, das Programm durchsucht den gesamten Unicode-Zeichenraum – über 150.000 codierte Zeichen aus mehr als 150 Schriftsystemen – nach Zeichen, die einem lateinischen Buchstaben ähneln oder denselben Laut tragen, und bietet sie je nach Grad der gewünschten Ähnlichkeit zum Ausgangstext als Ersatz an.

Die Substitution lateinischer Buchstaben durch Äquivalente wird auch in einer besonderen Form des Phishings verwendet, dem *IDN-Homograph-Angriff*, bei dem täuschend ähnlich geschriebene Domain-Namen für Phishing-Seiten registriert werden. Alienizer verwendet diesen Mechanismus nicht um Identität vorzutäuschen, sondern um in einer Gegenwart, die zunehmend von maschinell generiertem Text geprägt ist, die scheinbare Stabilität der Beziehung zwischen Laut und Schrifzeichen Wort und Bedeutung 

### Was man damit machen kann

**Einen Text transformieren und exportieren.** Den transformierten Text als Datei herunterladen oder in die Zwischenablage kopieren – für den Einsatz in anderen Programmen, als Druckvorlage oder für weitere Verarbeitung.

**Die Zeichen inspizieren.** Fährt man mit der Maus über ein substituiertes Zeichen, zeigt ein Tooltip den Unicode-Namen, das Schriftsystem und den visuellen Distanzwert – das sonst unsichtbare Innenleben der Transformation wird lesbar.

**Ketten von Transformationen erzeugen.** Das Ergebnis einer Transformation lässt sich direkt in das Eingabefeld zurückgeben und erneut durch den Alienizer schicken. Bei jedem Durchlauf werden weitere substituierbare Zeichen erfasst; der Text entfernt sich in Schritten von seinem Ursprung. 

**Textumgebunden verändern.**Ebenso lässt sich ein transformierter Text per Copy-Paste in eine andere Umgebung übertragen – in einen Chat, ein Dokument, eine Website – und dort weiterverwenden, wo sein veränderter Codierungsstatus weitere Effekte erzeugt: gescheiterte Textsuchen, unerwartetes Spracherkennungsverhalten, Irritationen in automatischer Textverarbeitung.

**Presets und eigene Einstellungen kombinieren.** Die Presets (Subtil, Schwelle, Drastisch, Total) definieren klar voneinander abgegrenzte Stufen für die Ersetzung; die Slider darunter erlauben eine stufenlose Kontrolle über Substitutionsrate, visuelle Distanz und Schriftauswahl. Außerdem lassen sich Schriftsysteme auswählen, mit denen man arbeiten will.

### Welche Schriften wie verwendet werden

Alienizer kennt aktuell 46 Schriftsysteme: europäische Alphabete (Kyrillisch, Griechisch, Armenisch, Georgisch), südasiatische Silbenschriften (Devanagari, Bengali, Tamil, Malayalam), ostasiatische Schriften (Hiragana, Katakana), semitische Alphabete (Arabisch, Hebräisch, Syrisch), afrikanische Schriften (Äthiopisch, Vai, Bamum, N'Ko, Adlam, Meroitisch) und weitere.

Um die visuelle Ähnlichkeit herzustellen werden die einbezogenen Buchstaben als 48×48-Pixel-Bitmap gerendert und mit allen lateinischen Buchstaben verglichen. Je kleiner der Pixelabstand, desto ähnlicher das Zeichen. Dieser Abstandswert läuft von 0,0 (pixelidentisch) bis 1,0 (völlig verschieden). Das Werkzeug erlaubt, die Toleranzschwelle frei zu setzen: eng für Zeichen, die wie perfekte Kopien aussehen; weiter für Zeichen, die beginnen, ihre fremde Herkunft zu zeigen.

Viele Schriften – Devanagari, Äthiopisch, Arabisch, Adlam, Vai, Meroitisch und aus Fernost –  sehen allerdings so anders aus als das lateinische Alphabet, dass rein visuelle Ähnlichkeit keine optische Verbindung herstellt. Ihre Unicode-Namen verraten aber einen Laut: „DEVANAGARI LETTER KA", „ETHIOPIC SYLLABLE MA", „ADLAM SMALL LETTER MIIM". Diese Information wird systematisch ausgewertet: Ein lateinisches „m" kann durch ein Devanagari-म, ein Hebräisches מ oder ein Adlam-𞤃 ersetzt werden. Dieses phonetische Verfahren wird allerdings erst ab einer bestimmten Stufe der "Alienisierung" eingesetzt, Lautidentität kann logischerweise zugleich große visueller Distanz bedeuten und daher nicht mehr sichtbar sein. Hier wird also der Verfremdungseffekt am Ausgangstext sehr stark sein.

---

### Technischer Hintergrund

Unicode ist der universelle Standard für die schriftbasierte digitale Kommunikation, der jedem Zeichen aus jeder Schrift der Welt eine eindeutige Nummer zuweist – einen sogenannten Codepoint. Das lateinische „a" hat den Codepoint U+0061, das kyrillische „а" U+0430; sie sehen gleich aus, sind aber für jeden Computer zwei völlig verschiedene Dinge. Texte bestehen auf digitaler Ebene nicht aus Bildern von Buchstaben, sondern aus Folgen solcher Nummern. Alienizer tauscht die Codepoints lateinischer Zeichen gegen Codepoints aus anderen Schriftsystemen mit zuvor untersuchter visueller Ähnlichkeit aus. Diese Untersuchung geschieht durch ein Pythonprogramm, das seine Ergebnisse in Tabellen abgelegt hat, die nun von der Javascript-Engine der Seite genutzt werden  – die vorgenommenen Veränderungen bleiben dabei bestehen, wenn der Text kopiert, weitergegeben, gespeichert oder maschinell verarbeitet wird. 

- Läuft vollständig im Browser, keine Daten werden übertragen
- Precomputed auf 167.586 visuellen Ähnlichkeitspaaren aus 46 Schriftsystemen
- Deterministisch: Jede Transformation mit demselben Seed ist reproduzierbar
- Zeicheninspektor: Hover über substituierte Zeichen zeigt Unicode-Name, Schrift, Distanzwert

Eine Dokumentation des Programms, mit der pythonsbasierten Ähnlichkeitsanalyse und den erzeugten Tabellen findet man unter www.github.com/roloffsimon/alienizer.

---

## EN

**Alienizer** is a character substitution tool: It replaces Latin letters with characters from other writing systems—depending on the settings, the changes may be barely noticeable or clearly visible

### **Was passiert**

Das lateinische Alphabet teilt seine Formen mit vielen anderen Schriften. Ein kyrillisches „а" (U+0430) und ein lateinisches „a" sehen identisch aus – sind aber zwei verschiedene Zeichen aus zwei verschiedenen Kulturen. Ein griechisches „ο", ein armenisches "ο" sind sich sehr ähnlich, ein georgisches "ო" sieht schon etwas anders aus. Und natürlich gibt es Zeichen wie das Devanagari-म, das Äthiopische ም oder das Adlam-𞤃, die alle den gleichen Laut tragen aber visuell völlig verschiedene Dimensionen besitzeh.

Alienizer nutzt diesen Spielraum der Schrift, das Programm durchsucht den gesamten Unicode-Zeichenraum – über 150.000 codierte Zeichen aus mehr als 150 Schriftsystemen – nach Zeichen, die einem lateinischen Buchstaben ähneln oder denselben Laut tragen, und bietet sie je nach Grad der gewünschten Ähnlichkeit zum Ausgangstext als Ersatz an.

Die Substitution lateinischer Buchstaben durch Äquivalente wird auch in einer besonderen Form des Phishings verwendet, dem *IDN-Homograph-Angriff*, bei dem täuschend ähnlich geschriebene Domain-Namen für Phishing-Seiten registriert werden. Alienizer verwendet diesen Mechanismus nicht um Identität vorzutäuschen, sondern um in einer Gegenwart, die zunehmend von maschinell generiertem Text geprägt ist, die scheinbare Stabilität der Beziehung zwischen Laut und Schrifzeichen Wort und Bedeutung 

### What You Can Do With It

**Transform and export text.** Download the transformed text as a file or copy it to the clipboard—for use in other programs, as a print template, or for further processing.

**Inspect the characters.** When you hover your mouse over a substituted character, a tooltip displays the Unicode name, the script, and the visual distance value—making the otherwise invisible inner workings of the transformation visible.

**Create chains of transformations.** The result of a transformation can be returned directly to the input field and run through the Alienizer again. With each pass, additional substitutable characters are captured; the text gradually diverges from its original form.

**Modify within the text.**Similarly, a transformed text can be transferred via copy-paste to another environment—a chat, a document, a website—and reused there, where its altered encoding status produces further effects: failed text searches, unexpected speech recognition behavior, and disruptions in automatic text processing.

**Combining presets and custom settings.** The presets (Subtle, Threshold, Drastic, Total) define clearly distinct levels of substitution; the sliders below allow for seamless control over substitution rate, visual distance, and font selection. Additionally, you can select the font systems you wish to work with.

### **Which scripts are used and how**

Alienizer, as of now, supports 46 writing systems: European alphabets (Cyrillic, Greek, Armenian, Georgian), South Asian syllabic scripts (Devanagari, Bengali, Tamil, Malayalam), East Asian scripts (Hiragana, Katakana), Semitic alphabets (Arabic, Hebrew, Syriac), African scripts (Ethiopic, Vai, Bamum, N'Ko, Adlam, Meroitic), and others.

To establish visual similarity, the included characters are rendered as 48×48-pixel bitmaps and compared with all Latin letters. The smaller the pixel distance, the more similar the character. This distance value ranges from 0.0 (pixel-identical) to 1.0 (completely different). The tool allows you to freely set the tolerance threshold: narrow for characters that look like perfect copies; wider for characters that begin to reveal their foreign origins.

Many scripts—Devanagari, Ethiopian, Arabic, Adlam, Vai, Meroitic, and those from the Far East—look so different from the Latin alphabet, however, that purely visual similarity does not establish an optical connection. Their Unicode names, however, reveal a sound: “DEVANAGARI LETTER KA,” “ETHIOPIC SYLLABLE MA,” “ADLAM SMALL LETTER MIIM.” This information is systematically evaluated: A Latin “m” can be replaced by a Devanagari म, a Hebrew מ, or an Adlam 𞤃. This phonetic method is, however, only used starting at a certain level of “alienation”; phonetic identity can logically also imply a great visual distance and therefore no longer be visible. Here, the alienation effect on the source text will be very strong.

### **Technical Background**

Unicode is the universal standard for text-based digital communication, which assigns a unique number—known as a code point—to every character in every writing system in the world. The Latin “a” has the code point U+0061, while the Cyrillic “а” has U+0430; they look the same, but to a computer, they are two completely different things. At the digital level, texts do not consist of images of letters, but of sequences of such numbers. Alienizer replaces the codepoints of Latin characters with codepoints from other writing systems that have been pre-analyzed for visual similarity. This analysis is performed by a Python program that stores its results in tables, which are then utilized by the site’s JavaScript engine—the changes made remain intact when the text is copied, shared, saved, or processed by machines.

- Runs entirely in the browser; no data is transmitted
- Precomputed for 167,586 visual similarity pairs from 46 writing systems
- Deterministic: Every transformation with the same seed is reproducible
- Character inspector: Hovering over substituted characters displays the Unicode name, font, and distance value

Documentation of the program, including the Python-based similarity analysis and the generated tables, can be found at [www.github.com/roloffsimon/alienizer](file:///Users/Sim/Downloads/Alienizer/www.github.com/roloffsimon/alienizer).

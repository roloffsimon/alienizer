# Alienizer: Similar Character Substitution 

## Theoretical and Artistic Contextualization

---

## 1. The Gist

**Alienizer** is a character substitution tool: It replaces Latin letters with characters from other writing systems — depending on the settings, the changes may be barely noticeable or clearly visible.

### 1.1 What Happens

The Latin alphabet shares its forms with many other scripts. A Cyrillic „а" (U+0430) and a Latin „a" look identical — but they are two different characters from two different cultures. A Greek „ο" and an Armenian „ο" are very similar; a Georgian „ო" already looks somewhat different. And of course there are characters like the Devanagari म, the Ethiopic ም, or the Adlam 𞤃 — all carrying the same sound but visually occupying entirely different dimensions.

Alienizer exploits this latitude of script: the program searches the entire Unicode character space — over 150,000 encoded characters from more than 150 writing systems — for characters that resemble a Latin letter or carry the same sound, and offers them as substitutes depending on the desired degree of similarity to the source text. 

The substitution of Latin letters with equivalents is also used in a particular form of phishing known as the *IDN homograph attack*, in which deceptively similar-looking domain names are registered for phishing sites. Alienizer uses this mechanism not to feign identity, but to interrogate the apparent stability of the relationship between sound and written character, word and meaning — in an era increasingly shaped by machine-generated text.

### 1.2 What You Can Do With It

**Transform and export text.** Download the transformed text as a file or copy it to the clipboard — for use in other programs, as a print template, or for further processing.

**Inspect the characters substituted.** When you hover over a substituted character, a tooltip displays the Unicode name, the script, and the visual distance value — making the otherwise invisible inner workings of the transformation readable.

**Create chains of transformations.** The result of a transformation can be returned directly to the input field and run through the Alienizer again. With each pass, additional substitutable characters are captured; the text gradually diverges from its original form.

**Glitch text.** Similarly, a transformed text can be transferred via copy-paste to another environment — a chat, a document, a website — and reused there, where its altered encoding status produces further effects: failed text searches, unexpected speech recognition behavior, disruptions in automatic text processing.

**Combining presets and custom settings.** The presets (Subtle, Threshold, Drastic, Total) define clearly distinct levels of substitution; the sliders allow for continuous control over substitution rate, visual distance, and script selection. Additionally, you can choose which writing systems to work with.

### 1.3 Which Scripts Are Used and How

Alienizer currently supports 46 scripts: European alphabets (Cyrillic, Greek, Armenian, Georgian), South Asian syllabic scripts (Devanagari, Bengali, Tamil, Malayalam), East Asian scripts (Hiragana, Katakana), Semitic alphabets (Arabic, Hebrew, Syriac), African scripts (Ethiopic, Vai, Bamum, N'Ko, Adlam, Meroitic), and others.

To establish visual similarity, the included characters are rendered as 48×48-pixel bitmaps and compared with all Latin letters. The smaller the pixel distance, the more similar the character. This distance value ranges from 0.0 (pixel-identical) to 1.0 (completely different). The tool lets you set the tolerance threshold freely: narrow for characters that look like perfect copies; wider for characters that begin to reveal their foreign origins.

Many scripts — Devanagari, Ethiopic, Arabic, Adlam, Vai, Meroitic, and those from East Asia — look so different from the Latin alphabet that purely visual similarity establishes no optical connection. Their Unicode names, however, reveal a sound: "DEVANAGARI LETTER KA," "ETHIOPIC SYLLABLE MA," "ADLAM SMALL LETTER MIIM." This information is systematically evaluated: a Latin "m" can be replaced by a Devanagari म, a Hebrew מ, or an Adlam 𞤃. This phonetic method is applied only starting at a certain level of alienation; phonetic identity can logically also imply great visual distance — here the alienation effect on the source text will be very strong.

### 1.4 Technical Background

Unicode is the universal standard for text-based digital communication, assigning a unique number — a code point — to every character in every writing system in the world. The Latin "a" has code point U+0061; the Cyrillic "а" has U+0430. They look the same, but to a computer they are two completely different things. At the digital level, texts do not consist of images of letters, but of sequences of such numbers. Alienizer replaces the code points of Latin characters with code points from other writing systems that have been pre-analyzed for visual similarity. This analysis is performed by a Python program that stores its results in tables, which are then used by the site's JavaScript engine — the changes made remain intact when the text is copied, shared, saved, or processed by machines.

- Runs entirely in the browser; no data is transmitted
- Precomputed for 167,586 visual similarity pairs from 46 writing systems
- Deterministic: every transformation with the same seed is reproducible
- Character inspector: hovering over substituted characters displays Unicode name, script, and distance value

---

## 2. Technical Infrastructure: Homoglyphs as Data Basis

### 2.1 Unicode Confusables (UTS #39)

The primary technical foundation is the official *Confusables* database of the Unicode Consortium, maintained within Unicode Technical Standard #39 (*Unicode Security Mechanisms*). This database records character pairs that appear visually identical or nearly identical — currently over 6,000 such pairs, across all writing systems encoded in the Unicode standard. The purpose of the database is defensive: it serves the detection and prevention of homograph attacks, in which attackers reconstruct domain names such as "microsoft.com" with Cyrillic characters to direct users to phishing sites.

For the present project, this database is the raw material of a revaluation: what the security discourse considers a threat — the visual indistinguishability of characters from different writing systems — becomes a poetic procedure. The Python library `confusable_homoglyphs` makes this data programmatically accessible and allows querying visual equivalents for each character, including information about which writing system (Unicode block) the equivalent belongs to.

The limits of the Confusables database are well known. It operates binarily — a character pair is either confusable or not — and maps no gradations of visual similarity. It is also incomplete, particularly in the domain of CJK characters (Chinese, Japanese, Korean), as machine learning research has shown. We are planning to incorporate findings from research projects in our data in the near future.

### 2.2 Bitmap Rendering phonetic comparison

Each Unicode character is rendered as a 48×48-pixel bitmap (grayscale, in a font with broad Unicode coverage), and visual similarity is computed as the mean absolute pixel difference (MAE) between the bitmaps of two characters. The result is a continuous distance measure between 0.0 (pixel-identical) and 1.0 (maximally different) that quantifies visual similarity for every character pair. A prototype run over 6,659 candidate characters from 46 writing systems against 62 Latin reference characters yielded 167,586 visual matches.

The visual similarity computation encounters a limit that is aesthetically productive: for the South and Southeast Asian scripts (Devanagari, Bengali, Tamil, Thai, Lao, Myanmar, Khmer), for Arabic and Hebrew, and for the African syllabic scripts (Ethiopic, Vai, Bamum), visual distances to Latin letters are uniformly high — these characters simply do not look Latin. They therefore remain unreachable for the visual layer of alienization, unless the distance threshold is set so high that European scripts too enter the zone of the unrecognizable.

The solution is a second substitution layer operating not on visual but on phonetic equivalence. The official Unicode character names contain, in most writing systems, the phonetic value of the character: "DEVANAGARI LETTER KA" encodes the sound /k/, "THAI CHARACTER KO KAI" encodes /k/, "ETHIOPIC SYLLABLE HA" encodes /h/, "ADLAM SMALL LETTER MIIM" encodes /m/. This information can be systematically extracted, normalized, and assigned to Latin characters. It thus becomes possible to replace a Latin "m" not only with a visually similar character (for which there are few good candidates) but with a Devanagari म, a Hebrew מ, an Ethiopic ም, or an Adlam 𞤃 — characters that represent the same sound but visually belong to an entirely different world.

The procedure operates in two layers: the visual layer first attempts to occupy as many positions as possible; the phonetic layer then fills the remaining gaps if drastic or total ureadability of the output is desired.  In doing so, the phonetic layer intensifies the effect relative to the visual layer: where the visual layer relies on resemblance — the foreign should look as much like the familiar as possible — the phonetic layer relies on phonetic identity at maximum visual distance. A Devanagari म or an Ethiopic ም is not a double for "m" but its phonetic equivalent from another visual world; the estrangement here is not disguised but open.

### 2.3 The Substitution Algorithm: Exact Reconstruction

The implementation of the procedure is divided into two separate processing phases, whose separation is itself a conceptual decision: the computationally intensive preparatory work — calculating visual and phonetic similarities for the entire relevant Unicode space — takes place offline in Python and is stored as precomputed JSON tables; the actual substitution runs client-side in JavaScript, without server connection, directly in the browser. The tables are the crystallized result of a one-time computation; the engine is the tool that interprets them.

**Phase 1: Table Construction (Python, offline)**

The starting point of the visual similarity calculation is 62 reference characters: the 26 lowercase letters, 26 uppercase letters, and 10 digits of the Latin alphabet. Each of these characters is rendered as a 48×48-pixel grayscale bitmap — using Pillow (Python Imaging Library), DejaVu Sans at 36 points, on a white background. Centering is achieved by reading the bounding box of the character (`font.getbbox()`), which delivers the actual ink edges: the character is positioned horizontally and vertically so that its visual center of gravity hits the middle of the 48×48 cell. The result is a normalized grayscale array with values between 0.0 (black, ink) and 1.0 (white, background).

The same rendering process is applied to all candidate characters: those codepoints from 46 defined script ranges (from Cyrillic through Devanagari and Ethiopic to Adlam) that pass the Unicode category filters — control characters (category C) and space separators (category Zs) are excluded. An additional filter eliminates all candidates whose bitmap has a mean absolute pixel distance of less than 0.02 from the .notdef glyph (U+FFFF): characters the font cannot represent and displays as a placeholder appear so similar to the blank form that they are identifiable as font-coverage artifacts and must be excluded from the candidate pool.

The visual distance between two characters is the *Mean Absolute Error* (MAE) of their normalized pixel arrays:

```
dist(a, b) = mean(|a – b|) ∈ [0.0; 1.0]
```

A value of 0.0 means pixel-identical bitmaps; 1.0 means that every pixel of one character has the maximum distance from the corresponding pixel of the other. The threshold for table construction is 0.30: only character pairs whose MAE falls below this value are included. The visual table stores up to 50 candidates for each of the 62 reference characters (sorted by ascending distance) with their metadata: distance value, Unicode codepoint, script affiliation, Unicode character name.

The phonetic table is constructed by a different procedure. The official Unicode character names encode, in most writing systems, the phonetic value of the character: "DEVANAGARI LETTER KA" designates /k/, "ETHIOPIC SYLLABLE MA" designates /m/, "ADLAM SMALL LETTER MIIM" designates /m/. A sequence of regex patterns extracts the phonetic designator from the character name (e.g., "KA", "MA", "SHA"), which is then mapped onto IPA symbols via a normalization table (`PHONEME_NORMALIZE`): "ka" → /k/, "sha" → /ʃ/, "he" → /h/. For each Latin character there is a list of expected IPA values (`LATIN_TO_PHONEME`): for "k" this is solely /k/, for "c" the set {/k/, /tʃ/, /s/}, for "a" the set {/a/, /æ/, /ɑ/}. A candidate character belongs in the phonetic table for a reference character if its extracted IPA value falls within this set. The phonetic table also stores the MAE value of the visual bitmap distance as metadata, available for inspection in the character tooltip.

**Phase 2: Substitution (JavaScript, client-side)**

The JavaScript engine `alienisiere()` takes the input text, both lookup tables, and a parameter set. All positions of Latin characters in the text are first identified; non-Latin content — spaces, punctuation, already non-Latin characters — passes through unchanged.

The positions to be substituted are determined in a single shuffling step: the Fisher-Yates algorithm shuffles the list of all Latin positions under the control of a seeded PRNG (Mulberry32 algorithm). From this shuffled list, the first `n_target = round(n_latin × replacement_rate)` positions form the target set. These are immediately split into two groups based on `phonetic_ratio`: the first `round(n_target × phonetic_ratio)` positions form the *phonetic-primary* group; the remainder form the *visual-primary* group. Both groups are determined in the same shuffle pass — a single traversal of the position list produces the entire assignment.

*Visual-primary group:* For each position, the visual table for the corresponding character is consulted. The candidate list is filtered to those entries with `dist ≤ visual_max_dist`, then optionally narrowed to a preferred script subset if `prefer_scripts` is set (falling back to the full filtered list if the preferred subset is empty). From the remaining candidates, a *weighted* random selection chooses: each candidate receives a weight proportional to the inverse of its distance, `w = 1 / (d + 0.001)`, creating a preference for the nearest visual equivalents without deterministically enforcing them. If no visual candidate passes the filter — because the character has no sufficiently close visual counterpart in any available script — the phonetic table is consulted as fallback, with uniform (unweighted) random selection from candidates with `dist ≤ phonetic_max_dist`.

*Phonetic-primary group:* The order of consultation is reversed. The phonetic table is tried first, with uniform random selection from candidates within `phonetic_max_dist`. If no phonetic candidate is available, the visual table is consulted as fallback, with the same weighted selection logic as above. This group is the mechanism by which visually inaccessible scripts — Devanagari, Ethiopic, Arabic, Adlam — enter the transformed text as a first choice rather than a last resort: phonetic identity takes priority, visual similarity is secondary.

The asymmetry between the two groups is the architectural expression of a conceptual distinction: the visual-primary group produces substitutions that disguise their foreignness; the phonetic-primary group produces substitutions that display it. The `phonetic_ratio` parameter controls the proportion of each, and with it the aggregate character of the transformation — whether it leans toward concealment or toward overt estrangement.

The engine's output is not a simple string but a structured object: alongside the transformed text (`text`), an array with one entry per character (`chars`) stores for each position the original, the replacement character, the applied method ('visual', 'phonetic', or `null` for unchanged positions), the complete candidate data set (distance, codepoint, script, Unicode name), and a `replaced` flag. These metadata enable the character-precise inspector of the user interface: hovering over each substituted character opens a tooltip with the Unicode name, the writing system, and the distance value — the operation is here retrieved from its concealment, not to dissolve it, but to make its mechanism transparent.

**The Control Parameters and Their Aesthetic Function**

The procedure has six parameters that together determine the aesthetic register of the transformed text. `replacement_rate` (0.0–1.0) sets the proportion of Latin characters to be substituted; at 0.2, four fifths of the text remain untouched; at 1.0, every reachable character is replaced. `visual_max_dist` is the distance ceiling for visual candidates: values around 0.08 permit only perfect doubles (Cyrillic "а" for Latin "a"), values around 0.15 open the zone to recognizably different but structurally related forms — the aesthetically most productive territory —, values above 0.20 begin to include characters whose foreignness becomes visible at the surface. `phonetic_max_dist` sets the distance ceiling for phonetic candidates; at high values (0.45–0.50), characters from Devanagari, Amharic, or Adlam are admitted that share nothing with Latin letters except phonetic value, and the transformed text begins to show script families otherwise unreachable by visual similarity alone. `phonetic_ratio` (0.0–1.0) is the parameter that controls the balance between concealment and disclosure: at 0.0, the procedure is entirely visual-primary and the phonetic layer functions only as fallback for characters without visual candidates; at higher values, a growing share of target positions deliberately reaches into phonetically matched but visually alien territory, shifting the character of the output from homoglyphic camouflage toward open script substitution. `prefer_scripts` permits the thematic or cultural-political orientation of the transformed text: a text whose substitutions come preferentially from African scripts is a different text from one drawn into Asian or Middle Eastern writing systems — not on the visual surface, but in its digital composition. `seed` is the reproducibility instrument: the same text with the same parameters and the same seed produces exactly the same transformation in every run, which secures the tool quality of the procedure and makes its outputs citable.

---

## 3. Discursive Context: Projects and References

### 3.1 Allison Parrish: *Wendit Tnce Inf* (2022)

Parrish's work operates at an adjacent but systematically different point. For *Wendit Tnce Inf*, she trained Generative Adversarial Networks (GANs) at the pixel level on bitmap images of English words. The resulting images show letterforms that ghostly resemble the Latin alphabet without belonging to it — asemic prose poems that look like text without being text. The title itself arose when an OCR system attempted to read the title page: the machine recognizes characters where there are none.

The relationship to the Alienizer is one of inversion. Parrish generates characters that belong to no writing system but look as if they do. The Alienizer replaces characters that belong to one writing system with characters from another that look the same. In both cases, the coupling of visual form and linguistic function is dissolved — but in opposite directions. Parrish moves from code to image (GANs generate pixels); the Alienizer moves from code to code (Unicode substitution). In Parrish's work, legibility is destroyed; in the Alienizer, it remains intact while its foundation is undermined.

### 3.2 Xu Bing: *Tiānshū / Book from the Sky* (1987–91)

Xu Bing's monumental installation is the historical reference point for the generation of pseudo-scriptural systems. The work consists of hand-bound books, wall panels, and ceiling scrolls printed with approximately 4,000 invented characters, assembled from the radicals of the *Kangxi Dictionary* and matching real Chinese characters in stroke density and frequency. The work was crafted over four years in woodblock type — a labor of enormous artisanal intensity in the service of meaninglessness. No human being can read the text, not even Xu Bing himself.

The kinship lies in the gesture: a text carrying all the external features of legibility — typographic conventions, page design, familiar character density — withdraws from understanding. The difference: in Xu Bing, the characters are invented; in the Alienizer, they are real but wrongly assigned. Xu Bing's characters exist in no writing system; the substituted characters exist in several simultaneously. Xu Bing's gesture is the radical refusal of meaning; the Alienizer performs a displacement of belonging.

### 3.4 Zalgo Text

Zalgo text is produced by the excessive accumulation of Unicode Combining Characters — diacritical marks that stack above, below, and through base characters, visually destroying the text. Originating in 2004 as an internet meme on the Something Awful forum, the practice has developed into a distinct aesthetic in glitch art, surreal meme culture, and the horror aesthetics of digital subcultures.

The relationship to the Alienizer is one of axis shift. Zalgo destroys legibility vertically — characters are overgrown from above and below, the text driven into illegibility. The Alienizer shifts legibility horizontally — from one writing system to another, while the visual surface may remain intact or visibly transform depending on intensity level. Zalgo is loud; the Alienizer can whisper or shout. Both work with Unicode as aesthetic material, but at different points on the spectrum between visibility and invisibility of intervention.

### 3.5 Faux Cyrillic

The practice of Faux Cyrillic — using Cyrillic letters in Latin text according to visual resemblance, as in ЯUSSIAИ — is a playful everyday form of character substitution that functions primarily as a cultural stereotyping marker (the reversed letters as a sign of "the Russian"). A related historical practice is so-called Volapük encoding, in which in the early years of the internet Cyrillic text was represented by visually similar Latin characters to circumvent the missing support for the Cyrillic alphabet — a technical stopgap born of the constraints of script-system incompatibility.

The Alienizer systematizes and aestheticizes what occurs informally and functionally in these practices. It transforms the stopgap and the stereotype into a controllable poetic procedure.

### 3.6 The IDN Homograph Attack as Negative Mirror

In December 2001, Evgeniy Gabrilovich and Alex Gontmakher at the Technion in Israel published the paper *The Homograph Attack*, describing how Unicode URLs can be used to deceive about a website's identity. The basic technique: an attacker registers a domain name in which individual Latin letters are replaced by visually identical characters from other writing systems — for example, "microsoft.com" with Cyrillic "о" instead of Latin "o". The resulting name is indistinguishable from the original to the human eye, but points to a different address. Since 2005 the attack has been widely documented; ICANN has issued countermeasures; browsers display suspicious IDNs in Punycode form.

Alienizer employs exactly the same technical operation — the substitution of characters by their visual equivalents from other writing systems — but with a fundamentally different intention. The homograph attack exploits the invisibility of substitution to simulate identity; the Alienizer uses the possibility of substitution to interrogate identity — whether on the invisible or the visible side of the spectrum. The attack wants no one to notice the substitution; the poetic procedure wants the possibility of substitution — and in some settings the substitution itself — to shake confidence in the stability of the written.

---

## 6. Bibliography

### Artistic Works

- Parrish, Allison: *Wendit Tnce Inf*. Minneapolis: Aleator Press, 2022.
- Parrish, Allison: *Articulations*. Denver: Counterpath, 2018.
- Parrish, Allison: *200 (of 10,000) Apotropaic Variations*. Bad Quarto.
- Piringer, Jörg: *Data Poetry*. Denver: Counterpath, 2020.
- Piringer, Jörg: *xTXT*. Software, https://github.com/jpiringer/xTXT.
- Montfort, Nick: *Taroko Gorge*. 2009. https://nickm.com/taroko_gorge/.
- Montfort, Nick: *The Truelist*. Denver: Counterpath, 2017.
- Montfort, Nick / Lillian-Yvonne Bertram (eds.): *Output: An Anthology of Computer-Generated Text, 1953–2023*. Cambridge, MA: MIT Press / Counterpath, 2024.
- Xu Bing: *Tiānshū / Book from the Sky*. 1987–91. Installation.
- Xu Bing: *A, B, C…* Ceramic installation.
- Zakas, Laimonas: *Glitchr*. Facebook intervention.

### Technical Sources

- Unicode Consortium: *Unicode Technical Standard #39: Unicode Security Mechanisms*. https://unicode.org/reports/tr39/.
- Unicode Consortium: *confusables.txt*. https://www.unicode.org/Public/security/.
- `confusable_homoglyphs` (Python library). https://pypi.org/project/confusable-homoglyphs/.
- `homoglyph` (Codebox). https://github.com/codebox/homoglyph.
- Sawade, Chetan et al.: "Weaponizing Unicodes with Deep Learning." arXiv:2010.04382, 2020.
- Gabrilovich, Evgeniy / Alex Gontmakher: "The Homograph Attack." Technion, 2001.

### Theory and Research Literature

- Damrosch, David: "Scriptworlds: Writing Systems and the Formation of World Literature." *Modern Language Quarterly* 68/2 (2007), pp. 195–219.
- Bodin, Helena: "Heterographics as a Literary Device: Auditory, Visual, and Cultural Features." *Journal of World Literature* 3 (2018), pp. 196–216.
- Schmitz-Emans, Monika: "Mehrschriftlichkeit." In: Till Dembeck / Rolf Parr (eds.): *Literatur und Mehrsprachigkeit: Ein Handbuch*. Tübingen: Narr Francke Attempto, 2017, pp. 221–232.
- Dombrowski, Quinn: "Encoding Multilingualism: Technical Affordances of Multilingual Publication from Manuscripts to Unicode and OpenType." *The Journal of Electronic Publishing* (2024).
- Sövegjártó, Szilvia / Márton Vér (eds.): *Exploring Multilingualism and Multiscriptism in Written Artefacts*. Berlin: De Gruyter, 2024.
- *Script-switching in Literary Texts*. Online conference, 12–14 March 2025.
- Parrish, Allison: "Material Paratexts." Lecture, 2022. https://posts.decontextualize.com/material-paratexts/.


# Dictionary Indexing Analysis

Based on analysis of the actual data in `maajim.json`, here's how each dictionary indexes its entries:

## Summary Table

| Dictionary | Total Entries | Indexing Method | Pattern | Example Keys |
|------------|---------------|-----------------|---------|--------------|
| الصّحّاح في اللغة | 5,689 | Root letters (no spaces) | Simple root | أبا, أبب, صفرد |
| لسان العرب | 9,272 | Root letters (no spaces) | Simple root | أَبأ, شهنز, شكه |
| المعجم الوسيط | 33,141 | Words/verb forms (no spaces) | Full words | أبأه, أَبَا, أَبَاهُ |
| القاموس المحيط | 9,811 | Words with definite article | Full words with ال | الوَرَّةُ, الغَطَلَّسُ |
| مقاييس اللغة | 4,636 | Root letters (no spaces) | Simple root | أبو, هرض, بهش |
| العباب الزاخر | 1,528 | Root letters (no spaces) | Simple root | جرهس, دغف, جثط |
| المصباح المنير | 2,691 | Root letters WITH SPACES | Spaced root | إ لَ ا, ص د ي, ه ر و |
| جمهرة اللغة | 2,908 | Root letters with dashes | Pattern: ب - أ - ب - أ | و - أ - و - أ, ب - ذ - و - ا - ي |
| الدخيل في العربية | 1,551 | Foreign/borrowed words | Full words | آب, أباجور, أبرشية, أبريل |
| اللغة العربية المعاصرة | 5,777 | Root letters WITH SPACES | Spaced root | أ, أ ا, أ ا ب, أ ا ب ن و س |
| معجم الملابس | 1,502 | Full terms/phrases | Multi-word terms | الآخِنيُّ, أبو دثِار, أبو قلمون |
| معجم المغني | 6,193 | Mixed: roots in [brackets] + words | [أ و ب] or آب | حرف الألف, [أ و ب], آبَابِيلُ |
| معجم المصطلحات والألفاظ الفقهية | 3,501 | Full terms/phrases | Religious terms | الآبد, الآبق, آبى اللحم, آداب الخلاء |
| معجم الرائد | 23,193 | Mixed: letters + words | Various | حرف الألف, آ, لآئب, أوب |

---

## Detailed Analysis by Dictionary

### 1. الصّحّاح في اللغة (Al-Sihah)
**Pattern:** Traditional root letters without spaces
**Average length:** 3.1 characters
**Search strategy:** Extract root from user's word
**Examples:**
- أبا (3 letters)
- أبب (3 letters)
- صفرد (4 letters)
- فطحل (4 letters)

**Indexing rule:** Pure trilateral/quadrilateral roots without diacritics or spaces

---

### 2. لسان العرب (Lisan al-Arab)
**Pattern:** Traditional root letters, some with diacritics
**Average length:** 3.2 characters
**Search strategy:** Extract root from user's word
**Examples:**
- أَبأ (with fatha)
- شهنز (4 letters)
- شكه (3 letters)

**Indexing rule:** Pure roots, may include diacritics on first letter

---

### 3. المعجم الوسيط (Al-Waseet)
**Pattern:** Full words and verb forms
**Average length:** 4.8 characters
**Search strategy:** Search by actual word or verb forms
**Examples:**
- أبأه (verb form with object pronoun)
- أَبَا (verb form)
- أَبَاهُ (verb form with pronoun)
- الأبا (with definite article)

**Indexing rule:** Full words including verb conjugations and pronouns

---

### 4. القاموس المحيط (Al-Qamous)
**Pattern:** Full words, often with definite article ال
**Average length:** 7.6 characters
**Search strategy:** Search with definite article
**Examples:**
- الوَرَّةُ (with ال and full diacritics)
- الغَطَلَّسُ (with ال)
- أبَى (verb without ال)

**Indexing rule:** Nouns with definite article, verbs without

---

### 5. مقاييس اللغة (Maqayees)
**Pattern:** Traditional root letters
**Average length:** 3.0 characters
**Search strategy:** Extract root from user's word
**Examples:**
- أبو (3 letters)
- هرض (3 letters)
- بهش (3 letters)

**Indexing rule:** Pure trilateral roots

---

### 6. العباب الزاخر (Al-Ubab)
**Pattern:** Traditional root letters
**Average length:** 3.4 characters
**Search strategy:** Extract root from user's word
**Examples:**
- جرهس (4 letters)
- دغف (3 letters)
- جثط (3 letters)

**Indexing rule:** Pure trilateral/quadrilateral roots

---

### 7. المصباح المنير (Al-Misbah)
**Pattern:** Root letters separated by spaces
**Average length:** 5.0 characters (including spaces)
**Search strategy:** Extract root, then add spaces between letters
**Examples:**
- إ لَ ا
- ص د ي
- ه ر و
- أ س ا

**Indexing rule:** Root letters with single space between each letter

---

### 8. جمهرة اللغة (Jamharat al-Lugha)
**Pattern:** Root letters separated by " - " (space-dash-space)
**Average length:** 11.3 characters (including dashes)
**Search strategy:** Extract root, then format with " - " between letters
**Examples:**
- و - أ - و - أ (quadrilateral)
- ب - ذ - و - ا - ي (5 letters)
- د - ق - ق (trilateral)

**Indexing rule:** Root letters with " - " (space-dash-space) separator

---

### 9. الدخيل في العربية (Foreign Words)
**Pattern:** Full foreign/borrowed words
**Average length:** 6.3 characters
**Search strategy:** Search by complete word (no root extraction)
**Examples:**
- آب (August)
- أباجور (lampshade)
- أبرشية (parish)
- أبريل (April)
- أبلكاج (plywood)

**Indexing rule:** Full borrowed words as-is, no root system

---

### 10. اللغة العربية المعاصرة (Contemporary Arabic)
**Pattern:** Root letters separated by spaces
**Average length:** 7.7 characters (including spaces)
**Search strategy:** Extract root, add spaces between letters
**Examples:**
- أ (single letter)
- أ ا (two letters)
- أ ا ب (three letters)
- أ ا ب ن و س (six letters)

**Indexing rule:** Root letters with single space between each letter, includes modern terms

---

### 11. معجم الملابس (Clothing Dictionary)
**Pattern:** Full terms and multi-word phrases
**Average length:** 9.7 characters
**Search strategy:** Search by complete term or significant word
**Examples:**
- الآخِنيُّ (single word with article)
- أبو دثِار (two words - "abu dithar")
- أبو قلمون (two words - "abu qalamoun")
- الإِبْزِيم (with article)

**Indexing rule:** Full terms, may include multiple words or compound nouns

---

### 12. معجم المغني (Al-Mughni)
**Pattern:** Mixed - roots in [brackets] and full words
**Average length:** 7.5 characters
**Search strategy:** Try both bracketed root format and full word
**Examples:**
- حرف الألف (section header)
- [أ و ب] (root in brackets)
- [أ ب و] (root in brackets)
- آب (full word)
- أبَابِيلُ (full word)

**Indexing rule:** Roots enclosed in [brackets] with spaces, OR full words without brackets

---

### 13. معجم المصطلحات والألفاظ الفقهية (Fiqh Terms)
**Pattern:** Full religious/legal terms, may include phrases
**Average length:** 7.4 characters
**Search strategy:** Search by complete term
**Examples:**
- الآبد (with article)
- الآبق (with article)
- آبى اللحم (verb + object phrase)
- آداب الخلاء (manners/etiquette phrase)
- آداب القاضي (judge's etiquette)

**Indexing rule:** Full Islamic legal terms, including multi-word phrases

---

### 14. معجم الرائد (Al-Ra'id)
**Pattern:** Mixed - section headers, letters, and words
**Average length:** 3.4 characters
**Search strategy:** Search by word or root
**Examples:**
- حرف الألف (section header)
- آ (single letter)
- لآئب (full word)
- أوب (root/word)
- أول (root/word)

**Indexing rule:** Mixed format - includes headers, single letters, and full words/roots

---

## Categorization by Search Method

### Group A: Pure Root-Based (Simple)
Search by extracting root from word:
- الصّحّاح في اللغة
- لسان العرب (already indexed)
- مقاييس اللغة
- العباب الزاخر

**Search method:** Extract trilateral/quadrilateral root → search directly

---

### Group B: Root with Space Separators
Search by extracting root + formatting:
- المصباح المنير (space separator: "أ ب ب")
- اللغة العربية المعاصرة (space separator: "أ ب ب")
- جمهرة اللغة (dash separator: "أ - ب - ب")

**Search method:** Extract root → join with appropriate separator

---

### Group C: Root in Brackets (Special Format)
- معجم المغني (format: "[أ ب ب]" or direct word)

**Search method:** Extract root → try "[letter letter letter]" format + try direct word

---

### Group D: Full Words/Terms (No Root Extraction)
Search by complete word or significant terms:
- المعجم الوسيط (verb forms, conjugations)
- القاموس المحيط (words with definite article)
- الدخيل في العربية (borrowed words)
- معجم الملابس (clothing terms, compound nouns)
- معجم المصطلحات والألفاظ الفقهية (religious terms)
- معجم الرائد (mixed)

**Search method:**
1. Try word as-is
2. Try with ال prefix
3. Try removing ال prefix
4. Try word stemming/normalization

---

## Recommended LLM Tool Design

### Tool: `search_all_dictionaries`

**Parameters:**
```typescript
{
  words: string[],           // Words to search (required)
  roots?: string[],          // Guessed roots (optional)
  dictionaries?: string[],   // Specific dictionaries to search (optional)
  include_indexed: boolean   // Include already-indexed لسان العرب (default: false)
}
```

**LLM Instructions (in system prompt):**
```
When searching across all dictionaries:

1. For user words, you must provide BOTH:
   - words: The actual words the user mentioned
   - roots: Your best guess of the trilateral/quadrilateral roots

2. Root extraction tips:
   - Remove prefixes: ال, ب, ك, ف, ل, و
   - Remove suffixes: ة, ات, ين, ون, ها, هم, كم
   - Identify core 3-4 root letters
   - Example: "الكتاب" → root "ك ت ب"

3. The tool will search each dictionary using its specific indexing method:
   - Some use pure roots (ك ت ب)
   - Some use spaced roots (ك ت ب)
   - Some use bracketed roots ([ك ت ب])
   - Some use full words (الكتاب)
   - The tool handles all formats automatically

4. Specialized dictionaries:
   - "الدخيل في العربية": Only for foreign/borrowed words
   - "معجم الملابس": Only for clothing/textile terms
   - "معجم المصطلحات والألفاظ الفقهية": Only for Islamic legal terms
```

---

## Implementation Strategy

### Phase 1: Add database column
Add `indexing_pattern` column to `dictionaries` table:
```sql
ALTER TABLE dictionaries ADD COLUMN indexing_pattern TEXT;
```

Values:
- `root_simple`: Pure root (ك ت ب)
- `root_spaced`: Root with spaces (ك ت ب)
- `root_dashed`: Root with dashes (ك - ت - ب)
- `root_bracketed`: Root in brackets with spaces ([ك ت ب])
- `word_full`: Full words/terms
- `word_with_al`: Words with definite article
- `mixed`: Multiple patterns

### Phase 2: Build search service
Create `AllDictionariesSearchService` that:
1. Takes words + roots from LLM
2. Queries each dictionary using its pattern
3. Returns results grouped by dictionary

### Phase 3: Update tool
Modify `DictionaryToolAgent` to use both:
- `search_dictionary` (current indexed search)
- `search_all_dictionaries` (new comprehensive search)

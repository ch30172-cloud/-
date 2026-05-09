# מערכת עימוד אוטומטי - Hebrew Auto Paginator

מערכת Web ב-Node.js שמקבלת קובץ Word (.docx) ומפיקה PDF מעומד בפורמט שני טורים מאוזנים, עם כותרות רצות ומספור אוטומטי. מתאים לספרי קודש, מאמרים אקדמיים וכד'.

## תכונות

- **טעינת .docx**: שמירה על היררכיית כותרות (Title, Heading 1/2/3) דרך `mammoth`.
- **מנוע עימוד מותאם אישית**: מודד כל שורה (`Range.getClientRects`) ומפצל לעמודים תוך **איזון גובה הטורים** באמצעות חיפוש נקודת הפיצול האופטימלית בכל עמוד.
- **כותרות רצות + מספרי עמוד**: 3 סגנונות, מספור באותיות עבריות (כולל גרשיים) או בספרות.
- **הגדרות מלאות**: גודל עמוד, שוליים פנים/חוץ, מספר טורים, רווח טורים, פונט וגודל גוף הטקסט.
- **סגנונות מוכנים**: ספר קודש, מאמר אקדמי, רומן.
- **תצוגה מקדימה חיה** + **ייצוא PDF** דרך Puppeteer.

## הרצה

```bash
npm install
npm start
# פתחי http://localhost:3000
```

## ארכיטקטורה

```
server.js          - Express: /api/upload, /api/render
lib/parse-docx.js  - mammoth → items [{type, text}]
lib/layout.js      - מודד שורות + מפצל לעמודים מאוזנים
lib/template.js    - HTML/CSS לעמודים (RTL, @page)
lib/render.js      - Puppeteer → PDF
lib/presets.js     - 3 סגנונות מוכנים
public/            - Frontend (vanilla JS)
```

### אלגוריתם איזון הטורים (lib/layout.js)

1. **מדידה**: רנדור כל הבלוקים בעמודה אחת ברוחב טור-יחיד. עבור כל בלוק, פיצול ל"שורות" באמצעות `Range.getClientRects()` ושמירת גובה כל שורה.
2. **חיתוך לעמודים** (`splitPages`): גרידי - מרחיב את `end` כל עוד קיים `mid` ב-`[start..end]` ש-`sum(start..mid) ≤ colHeight` וגם `sum(mid..end) ≤ colHeight`.
3. **בחירת `mid`** (`bestSplitWithin`): מבין כל פיצולי הטור החוקיים בעמוד הנוכחי, בוחר את ה-`mid` שממזער `|height(colA) - height(colB)|`.
4. **break-before**: כותרת `h1` תמיד מתחילה עמוד חדש (אפשר לשלוט עם `breakH1OnNewPage`).

זוהי הסיבה שהטורים יוצאים מאוזנים גם כשהבלוק האחרון בעמוד גולש - הוא נשבר ב-mid אופטימלי.

## API

- `POST /api/upload` - multipart, שדה `file` עם .docx → `{title, items, messages}`
- `POST /api/render` - JSON `{items, presetId?, configOverrides?, format: 'html'|'pdf'}`
- `GET /api/presets` - רשימת preset IDs

## הערות

- העימוד דורש Chromium (מותקן אוטומטית עם Puppeteer). בשרת בלי GUI חובה `--no-sandbox` (כבר מוגדר).
- הערות שוליים נתמכות במבנה הנתונים אך עדיין לא ממוקמות בתחתית כל עמוד - הן זורמות בטקסט. (TODO).

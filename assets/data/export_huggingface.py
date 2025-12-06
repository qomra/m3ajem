#!/usr/bin/env python3
"""
Export M3ajem Database to Hugging Face Dataset
===============================================
Exports the SQLite database to Parquet files for Hugging Face.

Usage:
    python export_huggingface.py
    python export_huggingface.py --output ./hf_dataset

Output structure:
    hf_dataset/
    ├── README.md
    ├── dictionaries.parquet
    ├── roots.parquet
    └── words.parquet
"""

import sqlite3
import os
import argparse
import json
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("pandas not installed. Installing...")
    os.system("pip install pandas pyarrow")
    import pandas as pd

DB_PATH = "database/dictionary.db"

def export_to_huggingface(db_path: str, output_dir: str):
    """Export database to Hugging Face dataset format."""

    print("=" * 60)
    print("M3AJEM HUGGING FACE EXPORT")
    print("=" * 60)

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        return

    os.makedirs(output_dir, exist_ok=True)

    conn = sqlite3.connect(db_path)

    # Export dictionaries table
    print("\n[1/4] Exporting dictionaries...")
    df_dicts = pd.read_sql_query("SELECT * FROM dictionaries", conn)
    df_dicts.to_parquet(os.path.join(output_dir, "dictionaries.parquet"), index=False)
    print(f"  ✓ Exported {len(df_dicts)} dictionaries")

    # Export roots table
    print("\n[2/4] Exporting roots...")
    df_roots = pd.read_sql_query("""
        SELECT r.id, r.dictionary_id, d.name as dictionary_name, d.type as dictionary_type,
               r.root, r.definition, r.first_word_position
        FROM roots r
        JOIN dictionaries d ON r.dictionary_id = d.id
    """, conn)
    df_roots.to_parquet(os.path.join(output_dir, "roots.parquet"), index=False)
    print(f"  ✓ Exported {len(df_roots):,} roots")

    # Export words table (indexed words)
    print("\n[3/4] Exporting words (indexed)...")
    df_words = pd.read_sql_query("""
        SELECT w.id, w.root_id, r.root, w.word, w.first_position, w.all_positions
        FROM words w
        JOIN roots r ON w.root_id = r.id
    """, conn)
    df_words.to_parquet(os.path.join(output_dir, "words.parquet"), index=False)
    print(f"  ✓ Exported {len(df_words):,} indexed words")

    # Generate statistics
    print("\n[4/4] Generating statistics...")

    stats = {
        "total_dictionaries": len(df_dicts),
        "total_roots": len(df_roots),
        "total_indexed_words": len(df_words),
        "by_type": {}
    }

    for dtype in df_dicts['type'].unique():
        type_dicts = df_dicts[df_dicts['type'] == dtype]
        type_roots = df_roots[df_roots['dictionary_type'] == dtype]
        stats["by_type"][dtype] = {
            "dictionaries": len(type_dicts),
            "roots": len(type_roots),
            "dictionary_names": type_dicts['name'].tolist()
        }

    # Create README
    readme_content = generate_readme(df_dicts, df_roots, df_words, stats)
    with open(os.path.join(output_dir, "README.md"), 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print(f"  ✓ Generated README.md")

    conn.close()

    # Print summary
    print("\n" + "=" * 60)
    print("EXPORT COMPLETE")
    print("=" * 60)
    print(f"\nOutput directory: {output_dir}")
    print(f"\nFiles created:")
    for f in os.listdir(output_dir):
        size = os.path.getsize(os.path.join(output_dir, f))
        print(f"  - {f}: {size / (1024*1024):.2f} MB")

    print(f"\nStatistics:")
    print(f"  - Dictionaries: {stats['total_dictionaries']}")
    print(f"  - Total entries: {stats['total_roots']:,}")
    print(f"  - Indexed words: {stats['total_indexed_words']:,}")

    for dtype, data in stats['by_type'].items():
        print(f"\n  {dtype}:")
        print(f"    - {data['dictionaries']} dictionaries")
        print(f"    - {data['roots']:,} entries")


def generate_readme(df_dicts, df_roots, df_words, stats):
    """Generate README.md for Hugging Face dataset in Arabic."""

    # Build dictionary tables by type with descriptions
    lo3awi_table = ""
    moraqman_table = ""

    for _, row in df_dicts.iterrows():
        root_count = len(df_roots[df_roots['dictionary_id'] == row['id']])
        desc = row['description'] if row['description'] else "-"
        line = f"| {row['name']} | {root_count:,} | {desc} |\n"
        if row['type'] == 'lo3awi':
            lo3awi_table += line
        else:
            moraqman_table += line

    # Check for indexed dictionary
    indexed_info = ""
    if len(df_words) > 0:
        indexed_roots = df_roots[df_roots['first_word_position'] >= 0]
        indexed_info = f"""
### المعاجم المفهرسة

يحتوي معجم **لسان العرب** على فهرسة على مستوى الكلمات، حيث يضم **{len(df_words):,}** كلمة مفهرسة عبر **{len(indexed_roots):,}** جذر.
يحتوي ملف `words.parquet` على بيانات المواضع للتنقل داخل التعريفات.
"""

    readme = f"""---
language:
- ar
tags:
- arabic
- dictionary
- nlp
- linguistics
- arabic-nlp
- معجم
- قاموس
- عربي
size_categories:
- 100K<n<1M
task_categories:
- text-generation
- question-answering
pretty_name: مَعاجِم - مجموعة المعاجم العربية
---

<div dir="rtl">

# مَعاجِم

مجموعة شاملة من المعاجم العربية تجمع بين المعاجم المطبوعة التقليدية والمعاجم المتخصصة المرقمنة بالذكاء الاصطناعي والمعاجم المفهرسة.

## وصف مجموعة البيانات

تحتوي هذه المجموعة على **{stats['total_dictionaries']} معجماً عربياً** بإجمالي **{stats['total_roots']:,} مدخل**،
تغطي اللغة العربية الفصحى والمعاصرة والمصطلحات المتخصصة في مختلف المجالات.

## الإحصائيات

| النوع | عدد المعاجم | عدد المدخلات |
|-------|-------------|--------------|
| مطبوع | {stats['by_type'].get('lo3awi', {}).get('dictionaries', 0)} | {stats['by_type'].get('lo3awi', {}).get('roots', 0):,} |
| مرقمنة | {stats['by_type'].get('moraqman', {}).get('dictionaries', 0)} | {stats['by_type'].get('moraqman', {}).get('roots', 0):,} |
| **المجموع** | **{stats['total_dictionaries']}** | **{stats['total_roots']:,}** |

---

## أنواع المعاجم

### المعاجم المطبوعة (مطبوع)

المعاجم العربية التقليدية التي تم رقمنتها. تشمل المراجع الكلاسيكية مثل لسان العرب والمعجم الوسيط.

| المعجم | المدخلات | الوصف |
|--------|----------|-------|
{lo3awi_table}

### المعاجم المرقمنة (مرقمنة)

معاجم متخصصة تم رقمنتها باستخدام تقنيات الذكاء الاصطناعي. تغطي المصطلحات التقنية والعلمية في مختلف المجالات.

| المعجم | المدخلات | الوصف |
|--------|----------|-------|
{moraqman_table}
{indexed_info}

---

## هيكل البيانات

تتكون مجموعة البيانات من ثلاثة ملفات بصيغة Parquet:

### `dictionaries.parquet`
البيانات الوصفية لكل معجم.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Unique dictionary ID |
| name | string | Dictionary name in Arabic |
| description | string | Dictionary description |
| indexing_pattern | string | Word indexing method |
| type | string | `lo3awi` or `moraqman` |

### `roots.parquet`
جميع مدخلات المعاجم (الجذور/المصطلحات وتعريفاتها).

| Column | Type | Description |
|--------|------|-------------|
| id | int | Unique entry ID |
| dictionary_id | int | Reference to dictionary |
| dictionary_name | string | Dictionary name |
| dictionary_type | string | Dictionary type |
| root | string | Arabic root or term |
| definition | string | Full definition text |
| first_word_position | int | Position of first indexed word (-1 if not indexed) |

### `words.parquet`
فهرس الكلمات للتنقل داخل التعريفات (حالياً لسان العرب فقط).

| Column | Type | Description |
|--------|------|-------------|
| id | int | Unique word ID |
| root_id | int | Reference to root entry |
| root | string | Parent root |
| word | string | Individual word form |
| first_position | int | Character position in definition |
| all_positions | string | JSON array of all positions |

---

## طريقة الاستخدام

```python
from datasets import load_dataset

# تحميل مجموعة البيانات
dataset = load_dataset("your-username/m3ajem")

# أو تحميل ملفات محددة
import pandas as pd

dictionaries = pd.read_parquet("hf://datasets/your-username/m3ajem/dictionaries.parquet")
roots = pd.read_parquet("hf://datasets/your-username/m3ajem/roots.parquet")
words = pd.read_parquet("hf://datasets/your-username/m3ajem/words.parquet")

# مثال: البحث عن جذر
results = roots[roots['root'].str.contains('كتب')]

# مثال: الحصول على جميع مدخلات معجم محدد
lisan = roots[roots['dictionary_name'] == 'لسان العرب']

# مثال: التصفية حسب نوع المعجم
traditional = roots[roots['dictionary_type'] == 'lo3awi']
digitized = roots[roots['dictionary_type'] == 'moraqman']
```

---

## الاقتباس

```bibtex
@dataset{{m3ajem2024,
  title = {{M3ajem: Arabic Dictionaries Collection}},
  author = {{M3ajem Team}},
  year = {{2024}},
  publisher = {{Hugging Face}},
  url = {{https://huggingface.co/datasets/your-username/m3ajem}}
}}
```

## شكر وتقدير

- المعاجم التقليدية مصدرها مكتبات عربية رقمية متنوعة
- الرقمنة بالذكاء الاصطناعي باستخدام GPT-4 Vision
- جزء من مشروع تطبيق معاجم للمعاجم العربية

---

*تم الإنشاء في {datetime.now().strftime('%Y-%m-%d')}*

</div>
"""

    return readme


def main():
    parser = argparse.ArgumentParser(description='Export M3ajem to Hugging Face')
    parser.add_argument('--db', type=str, default=DB_PATH, help='Database path')
    parser.add_argument('--output', type=str, default='./hf_dataset', help='Output directory')
    args = parser.parse_args()

    export_to_huggingface(args.db, args.output)


if __name__ == '__main__':
    main()

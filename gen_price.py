#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate PRICE_DATA and PRICE_LOOKUP from .numbers file."""
from numbers_parser import Document
import re, json

path = "/Users/pasha/Downloads/\u043f\u0440\u0430\u0439\u0441 \u0434\u043b\u044f \u0431\u043e\u0442\u0430 v5 (1).numbers"
doc = Document(path)

lines = []

# === БАЗА_ИЗДЕЛИЙ ===
sheet = doc.sheets["\u0411\u0410\u0417\u0410_\u0418\u0417\u0414\u0415\u041b\u0418\u0419"]
lines.append("=== \u0411\u0410\u0417\u0410_\u0418\u0417\u0414\u0415\u041b\u0418\u0419 ===")
lines.append("\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f | \u0418\u0437\u0434\u0435\u043b\u0438\u0435 | \u0411\u0430\u0437\u043e\u0432\u0430\u044f \u0446\u0435\u043d\u0430 (\u0440\u0443\u0431.)")
price_lookup = {}
for table in sheet.tables:
    for i, row in enumerate(table.iter_rows(min_row=0)):
        vals = [str(c.value) if c.value is not None else "" for c in row]
        if i == 0:
            continue  # skip header
        cat, name, price_str = vals[0], vals[1], vals[2]
        if not cat or not name:
            continue
        # Format price
        price_num = int(float(price_str))
        price_formatted = f"{price_num:,}".replace(",", " ")
        lines.append(f"{cat} | {name} | {price_formatted}")
        price_lookup[name] = price_num

# === ДРАЙВЕРЫ ===
lines.append("")
sheet = doc.sheets["\u0414\u0420\u0410\u0419\u0412\u0415\u0420\u042b"]
lines.append("=== \u0414\u0420\u0410\u0419\u0412\u0415\u0420\u042b ===")
lines.append("\u041a\u043e\u0434 | \u042d\u043b\u0435\u043c\u0435\u043d\u0442 | \u0422\u0438\u043f | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 | \u0411\u0430\u0437\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u0430")
for table in sheet.tables:
    for i, row in enumerate(table.iter_rows(min_row=0)):
        vals = [str(c.value) if c.value is not None else "" for c in row]
        if i == 0:
            continue
        code, element, typ, value, base = vals[0], vals[1], vals[2], vals[3], vals[4]
        if not code:
            continue
        # Format fixed values with spaces
        if typ == "fixed":
            try:
                num = int(float(value))
                value = f"{num:,}".replace(",", " ")
            except:
                pass
        base_display = base if base else "\u2014"
        lines.append(f"{code} | {element} | {typ} | {value} | {base_display}")

# === СПЕЦИФИКАЦИИ ===
spec_sheets = [s for s in doc.sheets if s.name.startswith("\u0421\u041f\u0415\u0426_")]
for sheet in spec_sheets:
    lines.append("")
    lines.append(f"=== {sheet.name} ===")
    for table in sheet.tables:
        first = True
        for i, row in enumerate(table.iter_rows(min_row=0)):
            vals = [str(c.value) if c.value is not None else "" for c in row]
            if all(v == "" for v in vals):
                continue
            if i == 0:
                # Title row
                if vals[0]:
                    lines.append(vals[0])
                continue
            if i == 1:
                # Header
                lines.append(" | ".join(v for v in vals[:4] if v))
                continue
            # Data rows
            row_vals = [v for v in vals[:4]]
            if all(v == "" for v in row_vals):
                continue
            lines.append(" | ".join(row_vals))

# === ПРИМЕНИМОСТЬ ===
prim_sheets = [s for s in doc.sheets if s.name.startswith("\u041f\u0420\u0418\u041c\u0415\u041d\u0418\u041c\u041e\u0421\u0422\u042c_")]
for sheet in prim_sheets:
    lines.append("")
    lines.append(f"=== {sheet.name} ===")
    lines.append("\u042d\u043b\u0435\u043c\u0435\u043d\u0442 | \u041a\u043e\u0434 | \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a | \u0412\u043e\u043f\u0440\u043e\u0441")
    for table in sheet.tables:
        for i, row in enumerate(table.iter_rows(min_row=0)):
            vals = [str(c.value) if c.value is not None else "" for c in row]
            if i <= 1:
                continue  # skip title and header
            elem, code, source, question = vals[0], vals[1], vals[2], vals[3]
            if not elem or not code:
                continue
            lines.append(f"{elem} | {code} | {source} | {question}")

price_data_str = "\n".join(lines)

# Output
print("===== PRICE_DATA =====")
print(price_data_str)
print("\n===== PRICE_LOOKUP =====")
# Output as JS object
print("const PRICE_LOOKUP = {")
for name, price in price_lookup.items():
    print(f"      '{name}': {price},")
print("    };")

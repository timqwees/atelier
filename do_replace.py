#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Replace PRICE_DATA and PRICE_LOOKUP in server.js."""
import re

server_path = "/Users/pasha/limitless atelier/limitless-atelier/server.js"

with open(server_path, "r", encoding="utf-8") as f:
    content = f.read()

# Read new PRICE_DATA
with open("/tmp/new_price_data.txt", "r", encoding="utf-8") as f:
    new_price_data = f.read()

# Read new PRICE_LOOKUP
with open("/tmp/new_price_lookup.txt", "r", encoding="utf-8") as f:
    new_price_lookup = f.read()

# === 1. Replace PRICE_DATA ===
# Find the PRICE_DATA template literal
# It starts with: const PRICE_DATA = `
# and ends with: `;
# We need to keep the СКРИПТ_БОТА section

# Extract the existing СКРИПТ_БОТА section from old PRICE_DATA  
script_match = re.search(r'(=== СКРИПТ_БОТА ===.*?)(?=\n`;)', content, re.DOTALL)
if script_match:
    script_section = script_match.group(1).rstrip()
    print("Found СКРИПТ_БОТА section")
else:
    print("WARNING: СКРИПТ_БОТА not found!")
    script_section = ""

# Build new PRICE_DATA content
new_content = f"\n{new_price_data}\n\n{script_section}\n"

# Replace PRICE_DATA
old_pd_match = re.search(r'(const PRICE_DATA = `).*?(`;\n)', content, re.DOTALL)
if old_pd_match:
    start, end = old_pd_match.start(0), old_pd_match.end(0)
    content = content[:start] + f"const PRICE_DATA = `{new_content}`;\n" + content[end:]
    print("Replaced PRICE_DATA")
else:
    print("ERROR: Could not find PRICE_DATA")

# === 2. Replace PRICE_LOOKUP ===
old_pl_match = re.search(r'    const PRICE_LOOKUP = \{.*?\};', content, re.DOTALL)
if old_pl_match:
    content = content[:old_pl_match.start()] + new_price_lookup + content[old_pl_match.end():]
    print("Replaced PRICE_LOOKUP")
else:
    print("ERROR: Could not find PRICE_LOOKUP")

# === 3. Update product name references in BASE_DETECTION_PROMPT ===
# Old: пиджак мужской кэжуал -> New: пиджак мужской кежуал
content = content.replace("\u043f\u0438\u0434\u0436\u0430\u043a \u043c\u0443\u0436\u0441\u043a\u043e\u0439 \u043a\u044d\u0436\u0443\u0430\u043b", "\u043f\u0438\u0434\u0436\u0430\u043a \u043c\u0443\u0436\u0441\u043a\u043e\u0439 \u043a\u0435\u0436\u0443\u0430\u043b")
# Old: пиджак мужской беспоук -> New: пиджак мужской беспооук
content = content.replace("\u043f\u0438\u0434\u0436\u0430\u043a \u043c\u0443\u0436\u0441\u043a\u043e\u0439 \u0431\u0435\u0441\u043f\u043e\u0443\u043a", "\u043f\u0438\u0434\u0436\u0430\u043a \u043c\u0443\u0436\u0441\u043a\u043e\u0439 \u0431\u0435\u0441\u043f\u043e\u043e\u0443\u043a")
# Old: пиджак кэжуал -> New: пиджак кежуал (in the prompt text)
content = content.replace("\u043f\u0438\u0434\u0436\u0430\u043a \u043a\u044d\u0436\u0443\u0430\u043b", "\u043f\u0438\u0434\u0436\u0430\u043a \u043a\u0435\u0436\u0443\u0430\u043b")
# Old: пиджак беспоук -> New: пиджак беспооук (in the prompt text)
content = content.replace("\u043f\u0438\u0434\u0436\u0430\u043a \u0431\u0435\u0441\u043f\u043e\u0443\u043a", "\u043f\u0438\u0434\u0436\u0430\u043a \u0431\u0435\u0441\u043f\u043e\u043e\u0443\u043a")
# Old: худи с капюшоном -> New: худи с капюшеном
content = content.replace("\u0445\u0443\u0434\u0438 \u0441 \u043a\u0430\u043f\u044e\u0448\u043e\u043d\u043e\u043c", "\u0445\u0443\u0434\u0438 \u0441 \u043a\u0430\u043f\u044e\u0448\u0435\u043d\u0435\u043c")
# Old: платье вечернее (свадебное) -> New: платье вечернее(свадебное)
content = content.replace("\u043f\u043b\u0430\u0442\u044c\u0435 \u0432\u0435\u0447\u0435\u0440\u043d\u0435\u0435 (\u0441\u0432\u0430\u0434\u0435\u0431\u043d\u043e\u0435)", "\u043f\u043b\u0430\u0442\u044c\u0435 \u0432\u0435\u0447\u0435\u0440\u043d\u0435\u0435(\u0441\u0432\u0430\u0434\u0435\u0431\u043d\u043e\u0435)")
# Old: пайетки -> New: паетки (in ДРАЙВЕРЫ context only, but let's be careful)
# Actually, "пайетки" appears in prompt text too, let's only change in specific places
print("Updated product name references")

with open(server_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone! server.js updated.")

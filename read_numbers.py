from numbers_parser import Document

path = "/Users/pasha/Downloads/\u043f\u0440\u0430\u0439\u0441 \u0434\u043b\u044f \u0431\u043e\u0442\u0430 v5 (1).numbers"
doc = Document(path)

# Print key sheets
target_sheets = [
    "\u0411\u0410\u0417\u0410_\u0418\u0417\u0414\u0415\u041b\u0418\u0419",
    "\u0414\u0420\u0410\u0419\u0412\u0415\u0420\u042b",
    "\u0421\u041f\u0415\u0426_\u0422\u041e\u041f",
    "\u0421\u041f\u0415\u0426_\u041a\u041e\u0420\u0421\u0415\u0422",
    "\u0421\u041f\u0415\u0426_\u041f\u041e\u041b\u0423\u041a\u041e\u0420\u0421\u0415\u0422",
    "\u0421\u041f\u0415\u0426_\u0411\u041b\u0423\u0417\u0410",
    "\u0421\u041f\u0415\u0426_\u0420\u0423\u0411\u0410\u0428\u041a\u0410",
    "\u0421\u041f\u0415\u0426_\u0421\u041e\u0420\u041e\u0427\u041a\u0410_\u041c\u0423\u0416\u0421\u041a\u0410\u042f",
]

# All ПРИМЕНИМОСТЬ sheets
primenimosty = [s.name for s in doc.sheets if s.name.startswith("\u041f\u0420\u0418\u041c\u0415\u041d\u0418\u041c\u041e\u0421\u0422\u042c")]

for sheet in doc.sheets:
    if sheet.name in target_sheets or sheet.name in primenimosty:
        print(f"\n{'='*80}")
        print(f"SHEET: {sheet.name}")
        print(f"{'='*80}")
        for table in sheet.tables:
            print(f"\n--- TABLE: {table.name} ---")
            for i, row in enumerate(table.iter_rows(min_row=0)):
                vals = []
                for cell in row:
                    vals.append(str(cell.value) if cell.value is not None else "")
                print(f"Row {i}: {vals}")

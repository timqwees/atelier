import openpyxl

wb = openpyxl.load_workbook('/Users/timqwees/Desktop/workspace/myworks/element/test/atelier/download_price_list.xlsx')
ws = wb.active

for row in ws.iter_rows(values_only=True):
    print(row)

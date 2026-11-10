import re

with open('src/components/Sales.tsx', 'r', encoding='utf-8') as f:
    sales = f.read()

sales = re.sub(
    r'\{\s*c\.name\s*\}\s*\{\s*c\.phone\s*\?[^}]+\}',
    '{c.name}',
    sales
)

with open('src/components/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(sales)

with open('src/components/Purchases.tsx', 'r', encoding='utf-8') as f:
    purchases = f.read()

purchases = re.sub(
    r'\{\s*v\.name\s*\}\s*\{\s*v\.phone\s*\?[^}]+\}',
    '{v.name}',
    purchases
)

with open('src/components/Purchases.tsx', 'w', encoding='utf-8') as f:
    f.write(purchases)

print("Options fix applied successfully")

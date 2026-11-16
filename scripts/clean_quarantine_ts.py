import re

with open('src/data/quarantineData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace old array chunk between "// Utility functions below" and "export function getUniquePemohonList"
pattern = r'// Utility functions below.*?(?=export function getUniquePemohonList)'
replacement = '// Utility functions below\n\n'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/data/quarantineData.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("quarantineData.ts cleaned successfully.")

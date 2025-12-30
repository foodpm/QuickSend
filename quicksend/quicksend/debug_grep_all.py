
import re

path = r"e:\code\quicksend\quicksend\static\dist\assets\index-uTLjeRix.js"
try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        matches = [m.start() for m in re.finditer(r"127\.0\.0\.1", content)]
        print(f"Found {len(matches)} matches.")
        for index in matches:
            start = max(0, index - 100)
            end = min(len(content), index + 100)
            print(f"Match at {index}: ...{content[start:end]}...")
except Exception as e:
    print(e)

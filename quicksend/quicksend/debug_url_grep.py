import re

path = r"e:\code\quicksend\quicksend\static\dist\assets\index-uTLjeRix.js"
try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Find 127.0.0.1 matches with context
        print("--- 127.0.0.1 Matches ---")
        matches = [m.start() for m in re.finditer(r"127\.0\.0\.1", content)]
        for index in matches:
            start = max(0, index - 100)
            end = min(len(content), index + 100)
            print(f"Match at {index}: ...{content[start:end]}...")
            
        # Find http://127.0.0.1 matches
        print("\n--- http://127.0.0.1 Matches ---")
        matches = [m.start() for m in re.finditer(r"http://127\.0\.0\.1", content)]
        for index in matches:
            start = max(0, index - 100)
            end = min(len(content), index + 100)
            print(f"Match at {index}: ...{content[start:end]}...")

        # Find any http:// or https:// absolute URLs
        print("\n--- Absolute URLs (sample) ---")
        urls = re.findall(r"https?://[^\s\"']+", content)
        for url in urls[:20]: # First 20
            print(url)

except Exception as e:
    print(e)

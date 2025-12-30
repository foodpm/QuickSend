
path = r"e:\code\quicksend\quicksend\static\dist\assets\index-uTLjeRix.js"
try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        index = content.find("127.0.0.1")
        if index != -1:
            start = max(0, index - 100)
            end = min(len(content), index + 100)
            print(f"Context: ...{content[start:end]}...")
        else:
            print("Not found")
except Exception as e:
    print(e)

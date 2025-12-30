import os
import json
import csv
import zipfile
import random
from PIL import Image, ImageDraw, ImageFont

def create_test_files():
    base_dir = "test_files"
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    
    print(f"Generating files in {os.path.abspath(base_dir)}...")

    # 1. Plain Text
    with open(os.path.join(base_dir, "hello.txt"), "w", encoding="utf-8") as f:
        f.write("Hello, this is a test file for QuickSend.\n你好，这是一个测试文件。")

    # 2. JSON
    data = {
        "app": "QuickSend",
        "version": 1.0,
        "features": ["file transfer", "text sharing"],
        "tested": True
    }
    with open(os.path.join(base_dir, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # 3. CSV (Excel compatible)
    with open(os.path.join(base_dir, "data.csv"), "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["ID", "Name", "Role", "备注"])
        writer.writerow([1, "Alice", "Sender", "测试人员"])
        writer.writerow([2, "Bob", "Receiver", "接收端"])

    # 4. HTML
    html_content = """<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body><h1>Hello QuickSend</h1><p>This is a test HTML file.</p></body>
</html>"""
    with open(os.path.join(base_dir, "page.html"), "w", encoding="utf-8") as f:
        f.write(html_content)

    # 5. Images (PNG & JPG) using Pillow
    try:
        # PNG
        img = Image.new('RGB', (200, 200), color = (73, 109, 137))
        d = ImageDraw.Draw(img)
        d.text((10,10), "QuickSend\nTest PNG", fill=(255,255,0))
        img.save(os.path.join(base_dir, "test_image.png"))

        # JPG
        img_jpg = Image.new('RGB', (300, 200), color = (255, 100, 100))
        d_jpg = ImageDraw.Draw(img_jpg)
        d_jpg.text((20,20), "QuickSend\nTest JPG", fill=(255,255,255))
        img_jpg.save(os.path.join(base_dir, "test_image.jpg"), quality=85)
    except Exception as e:
        print(f"Error generating images: {e}")

    # 6. ZIP Archive
    with zipfile.ZipFile(os.path.join(base_dir, "archive.zip"), 'w') as zf:
        zf.write(os.path.join(base_dir, "hello.txt"), arcname="hello_inside.txt")
        zf.write(os.path.join(base_dir, "data.json"), arcname="data_inside.json")

    # 7. Large Binary File (10MB)
    with open(os.path.join(base_dir, "large_file_10MB.bin"), "wb") as f:
        f.write(os.urandom(10 * 1024 * 1024))

    # 8. Special Characters Filename
    with open(os.path.join(base_dir, "特殊符号_✨_test.txt"), "w", encoding="utf-8") as f:
        f.write("Content with special characters in filename.")
    
    # 9. Markdown
    md_content = """# QuickSend Test
    ## Subtitle
    - Item 1
    - Item 2
    """
    with open(os.path.join(base_dir, "readme.md"), "w", encoding="utf-8") as f:
        f.write(md_content)

    # 10. Multi File (Custom Binary)
    with open(os.path.join(base_dir, "test_data.multi"), "wb") as f:
        # Write some mixed content: text, null bytes, random bytes
        f.write(b"HEADER_MULTI_FORMAT")
        f.write(b"\x00\x01\x02\x03")
        f.write(os.urandom(1024))
        f.write(b"FOOTER_MULTI_FORMAT")

    print("Done! Files generated.")

if __name__ == "__main__":
    create_test_files()

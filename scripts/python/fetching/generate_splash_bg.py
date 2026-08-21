from PIL import Image, ImageDraw
import io
import base64
import os

# Create splash background image
width, height = 450, 380
img = Image.new('RGB', (width, height))
draw = ImageDraw.Draw(img)

# Draw gradient background
for i in range(height):
    ratio = i / height
    r = max(5, int(15 - ratio * 10))
    g = max(5, int(12 - ratio * 7))
    b = max(15, int(25 - ratio * 10))
    draw.line([(0, i), (width, i)], fill=(r, g, b))

# Draw placeholder logo circle
cx, cy = width // 2, 100
draw.ellipse([cx-50, cy-50, cx+50, cy+50], fill='#6366f1')

# Draw 'AHG' text using basic shape approximation
draw.text((cx-22, cy-10), 'AHG', fill='white')

# Save to file
img.save('splash_bg.png')
print("Saved splash_bg.png")

# Convert to base64
buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()

# Save base64 to file
    with open(data_path('splash_bg_base64.txt'), 'w') as f:
    f.write(b64)
print(f"Base64 length: {len(b64)}")
import os
import shutil
import zipfile

# For onedir mode, just copy the folder to create standalone
src_dir = 'dist/AHG_Steam_Unlocker_TEST_2'

if not os.path.exists(src_dir):
    print(f'Source directory not found: {src_dir}')
    exit(1)

# Create ZIP of the entire folder
zip_name = 'dist/AHG Steam Unlocker v0.4.zip'
if os.path.exists(zip_name):
    os.remove(zip_name)

print(f'Creating ZIP archive of {src_dir}...')
with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, src_dir)
            zf.write(file_path, arcname)
            print(f'  Added: {arcname}')

size = os.path.getsize(zip_name)
print(f'Created: {zip_name}')
print(f'Size: {size / 1024 / 1024:.1f} MB')
print('')
print('To use: Extract the ZIP and run AHG_Steam_Unlocker_TEST_2.exe')

import os
import shutil
import subprocess
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent
frontend_dir = project_root / "frontend"

npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
if not npm_cmd:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        fallback_node = Path(local_app_data) / "Programs" / "node" / "npm.cmd"
        if fallback_node.exists():
            npm_cmd = str(fallback_node)

if not npm_cmd:
    npm_cmd = "npm"

print(f"Using npm: {npm_cmd}")
print(f"Running 'npm install' in {frontend_dir}...")

res1 = subprocess.run([npm_cmd, "install"], cwd=str(frontend_dir))
if res1.returncode != 0:
    print(f"npm install failed with code {res1.returncode}")
    sys.exit(res1.returncode)

print("\nRunning 'npm run build' in frontend...")
res2 = subprocess.run([npm_cmd, "run", "build"], cwd=str(frontend_dir))
if res2.returncode != 0:
    print(f"npm run build failed with code {res2.returncode}")
    sys.exit(res2.returncode)

print("\nFrontend build succeeded!")


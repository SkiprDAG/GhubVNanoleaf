import os
import shutil
import subprocess
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

print(f"Starting Vite dev server in {frontend_dir} with {npm_cmd}...")
subprocess.run([npm_cmd, "run", "dev"], cwd=str(frontend_dir))


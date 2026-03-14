import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def sidecar_output_name(target: str) -> str:
    suffix = ".exe" if "windows" in target else ""
    return f"sidecar-python-{target}{suffix}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Python sidecar for Tauri")
    parser.add_argument("--target", required=True, help="Rust target triple, e.g. x86_64-pc-windows-msvc")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    backend_dir = project_root / "backend"
    dist_dir = project_root / "dist-sidecar"
    work_dir = project_root / "build-sidecar"
    tauri_sidecar_dir = project_root / "src-tauri" / "sidecar"
    tauri_sidecar_dir.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(backend_dir / "sidecar.spec"),
            "--noconfirm",
            "--clean",
            "--distpath",
            str(dist_dir),
            "--workpath",
            str(work_dir),
        ],
        check=True,
        cwd=backend_dir,
    )

    produced_binary = dist_dir / ("sidecar-python.exe" if "windows" in args.target else "sidecar-python")
    if not produced_binary.exists():
        raise FileNotFoundError(f"PyInstaller output not found: {produced_binary}")

    destination = tauri_sidecar_dir / sidecar_output_name(args.target)
    shutil.copy2(produced_binary, destination)
    print(f"Copied sidecar to {destination}")


if __name__ == "__main__":
    main()

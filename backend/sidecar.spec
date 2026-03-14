# PyInstaller spec for the bundled FastAPI sidecar.
import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# project_root is the directory containing this spec file
project_root = os.path.dirname(os.path.abspath(SPEC))

hiddenimports = collect_submodules("app")
hiddenimports += collect_submodules("chromadb")
hiddenimports += [
    "tqdm",
    "chromadb.segment.impl.metadata.sqlite",
    "chromadb.segment.impl.vector.local_hnsw",
    "chromadb.segment.impl.vector.local_persistent_hnsw",
    "chromadb.db.responses",
]

datas = collect_data_files("chromadb")

block_cipher = None

a = Analysis(
    ["run_sidecar.py"],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="sidecar-python",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

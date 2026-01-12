# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('static/dist', 'static/dist'), ('static/fonts', 'static/fonts'), ('static/index.build.html', 'static'), ('static/index.html', 'static'), ('static/script.js', 'static'), ('static/favicon.ico', 'static'), ('static/favicon.png', 'static')],
    hiddenimports=['werkzeug.security'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='QuickSend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['maclogo.icns'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='QuickSend',
)
app = BUNDLE(
    coll,
    name='QuickSend.app',
    icon='maclogo.icns',
    bundle_identifier='com.quicksend.app',
)

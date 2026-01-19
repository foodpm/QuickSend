import os
import socket
import webbrowser
import threading
import time
import json
import difflib
import subprocess
import zipfile
import mimetypes
from datetime import datetime
from flask import Flask, render_template, request, send_from_directory, jsonify
from werkzeug.utils import secure_filename
import ctypes
from ctypes import wintypes
from analytics import analytics

# Fix for Windows Registry MIME type issue
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/css', '.css')

import sys
START_TIME = time.time()

# Configure paths
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app 
    # path into variable _MEIPASS'.
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

_IS_FROZEN = getattr(sys, 'frozen', False)
_PROJECT_ROOT = (os.path.dirname(sys.executable) if _IS_FROZEN else BASE_DIR)
try:
    if sys.platform == 'darwin':
        _SYSTEM_DATA = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support')
    elif sys.platform.startswith('win') or os.name == 'nt':
        _SYSTEM_DATA = os.getenv('PROGRAMDATA') or os.path.join(os.path.expanduser('~'), 'AppData', 'Local')
    else:
        _SYSTEM_DATA = os.path.join(os.path.expanduser('~'), '.local', 'share')
except Exception:
    _SYSTEM_DATA = os.path.join(os.path.expanduser('~'), '.local', 'share')
_DATA_ROOT = (_SYSTEM_DATA if _IS_FROZEN else _PROJECT_ROOT)

import uuid

CONFIG_FILE = os.path.join(_DATA_ROOT, 'QuickSend', 'config.json')
METADATA_FILE = os.path.join(_DATA_ROOT, 'QuickSend', 'metadata.json')
USERS_FILE = os.path.join(_DATA_ROOT, 'QuickSend', 'users.json')
SESSIONS_FILE = os.path.join(_DATA_ROOT, 'QuickSend', 'sessions.json')
LOG_FILE = os.path.join(_DATA_ROOT, 'QuickSend', 'log.txt')
SESSION_ID = uuid.uuid4().hex

def load_config():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_config(cfg):
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass

_config = load_config()
INSTALLATION_ID = (_config.get('installation_id') or '').strip()
INSTALLATION_CREATED = False
if not INSTALLATION_ID:
    INSTALLATION_ID = uuid.uuid4().hex
    _config['installation_id'] = INSTALLATION_ID
    save_config(_config)
    INSTALLATION_CREATED = True
UPLOAD_FOLDER = _config.get('upload_folder')
if not UPLOAD_FOLDER:
    if _IS_FROZEN:
        UPLOAD_FOLDER = os.path.join(_SYSTEM_DATA, 'QuickSend', 'uploads')
    else:
        UPLOAD_FOLDER = os.path.join(_PROJECT_ROOT, 'uploads')
    # Ensure default path is saved
    _config['upload_folder'] = UPLOAD_FOLDER
    save_config(_config)

TRANSFER_MODE = _config.get('mode', 'share') # share | oneway

STATIC_FOLDER = os.path.join(BASE_DIR, 'static')

# Create directories if they don't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__, static_folder=STATIC_FOLDER, template_folder=STATIC_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 16GB max upload size
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
try:
    app.json.ensure_ascii = False
except Exception:
    pass
app.config['JSON_AS_ASCII'] = False
VERSION = "1.0.8"
GLOBAL_PORT = 5000


def get_local_ip():
    try:
        # 0. Check env var
        env_ip = os.environ.get('HOST_IP') or os.environ.get('LAN_IP')
        if env_ip:
            return env_ip
            
        # 1. Try connecting to a public DNS server to find the interface used for routing
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.2)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if not ip.startswith('127.') and not ip.startswith('169.254.'):
                return ip
        except Exception:
            pass

        # 2. Get all network interfaces via getaddrinfo (more robust than gethostbyname_ex)
        candidates = []
        try:
            hostname = socket.gethostname()
            # Get all IPv4 addresses
            addr_infos = socket.getaddrinfo(hostname, None, socket.AF_INET)
            for info in addr_infos:
                ip = info[4][0]
                if ip not in candidates:
                    candidates.append(ip)
        except Exception:
            pass
            
        # Fallback to gethostbyname_ex if getaddrinfo fails
        if not candidates:
            try:
                hostname = socket.gethostname()
                candidates = socket.gethostbyname_ex(hostname)[2]
            except Exception:
                pass

        # Filter and prioritize
        # Priority: 192.168.x.x > 10.x.x.x > 172.16-31.x.x > other
        priority_ips = {'192': [], '10': [], '172': [], 'other': []}
        
        for ip in candidates:
            if ip.startswith('127.') or ip.startswith('169.254.'):
                continue
            elif ip.startswith('198.18.'):  # Filter out VPN/virtual adapters
                continue
            elif ip.startswith('192.168.'):
                priority_ips['192'].append(ip)
            elif ip.startswith('10.'):
                priority_ips['10'].append(ip)
            elif ip.startswith('172.'):
                try:
                    second_octet = int(ip.split('.')[1])
                    if 16 <= second_octet <= 31:
                        priority_ips['172'].append(ip)
                    else:
                        priority_ips['other'].append(ip)
                except:
                    priority_ips['other'].append(ip)
            else:
                priority_ips['other'].append(ip)
        
        # Return by priority
        for key in ['192', '10', '172', 'other']:
            if priority_ips[key]:
                return priority_ips[key][0]
                
    except Exception:
        pass
    
    return "127.0.0.1"

_LOCAL_IP_CACHE = {'ip': None, 'ts': 0}

def get_local_ip_fast():
    ip = _LOCAL_IP_CACHE.get('ip')
    ts = _LOCAL_IP_CACHE.get('ts') or 0
    if ip and (time.time() - ts) < 30:
        return ip
    ip = get_local_ip()
    _LOCAL_IP_CACHE['ip'] = ip
    _LOCAL_IP_CACHE['ts'] = time.time()
    return ip

def find_free_port(start=5000, end=5100):
    """
    Find a free port in the range [start, end].
    It attempts to bind to the port. If successful, the port is considered free.
    Note: We do NOT use SO_REUSEADDR here to ensure we find a truly free port
    that Flask can bind to without conflict.
    """
    for p in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # Removed SO_REUSEADDR to stricter check on Windows
            try:
                s.bind(("0.0.0.0", p))
                return p
            except OSError:
                continue
    return start

def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(str(msg) + "\n")
    except Exception:
        pass
    print(msg)


def track_event(event_name: str, props: dict = None):
    try:
        analytics.track({
            'event_name': event_name,
            'installation_id': INSTALLATION_ID,
            'session_id': SESSION_ID,
            'app_version': VERSION,
            'platform': ('darwin' if sys.platform == 'darwin' else ('win' if sys.platform.startswith('win') else 'linux')),
            'is_frozen': bool(_IS_FROZEN),
            'props': (props or {})
        })
    except Exception:
        pass

def _generate_password_hash(pwd):
    from werkzeug.security import generate_password_hash as _g
    return _g(pwd, method='pbkdf2:sha256')

def _check_password_hash(hashval, pwd):
    from werkzeug.security import check_password_hash as _c
    return _c(hashval, pwd)

def set_win_filetime(path, timestamp):
    try:
        # timestamp is float (time.time())
        # Convert to Windows FileTime (100-nanosecond intervals since Jan 1, 1601)
        ts = int((timestamp + 11644473600) * 10000000)
        
        creation_time = wintypes.FILETIME(ts & 0xFFFFFFFF, ts >> 32)
        access_time = wintypes.FILETIME(ts & 0xFFFFFFFF, ts >> 32)
        write_time = wintypes.FILETIME(ts & 0xFFFFFFFF, ts >> 32)
        
        # FILE_WRITE_ATTRIBUTES = 256
        handle = ctypes.windll.kernel32.CreateFileW(
            path, 256, 0, None, 3, 128, None
        )
        
        if handle == -1:
            return
            
        ctypes.windll.kernel32.SetFileTime(
            handle, ctypes.byref(creation_time), ctypes.byref(access_time), ctypes.byref(write_time)
        )
        ctypes.windll.kernel32.CloseHandle(handle)
        log(f'[Date] Updated file time: {path}')
    except Exception as e:
        log(f'[Date] Set file time failed: {e}')

def set_mac_filetime(path, timestamp):
    try:
        # Define structures for setattrlist
        class AttrList(ctypes.Structure):
            _fields_ = [
                ("bitmapcount", ctypes.c_ushort),
                ("reserved", ctypes.c_ushort),
                ("commonattr", ctypes.c_uint32),
                ("volattr", ctypes.c_uint32),
                ("dirattr", ctypes.c_uint32),
                ("fileattr", ctypes.c_uint32),
                ("forkattr", ctypes.c_uint32)
            ]

        class Timespec(ctypes.Structure):
            _fields_ = [
                ("tv_sec", ctypes.c_long),
                ("tv_nsec", ctypes.c_long)
            ]

        # ATTR_CMN_CRTIME = 0x00000200
        attr_list = AttrList()
        attr_list.bitmapcount = 5
        attr_list.reserved = 0
        attr_list.commonattr = 0x00000200
        attr_list.volattr = 0
        attr_list.dirattr = 0
        attr_list.fileattr = 0
        attr_list.forkattr = 0

        ts = Timespec()
        ts.tv_sec = int(timestamp)
        ts.tv_nsec = 0

        # Load libc
        libc = ctypes.CDLL(None)
        
        # setattrlist(const char* path, struct attrlist * attrList, void * attrBuf, size_t attrBufSize, unsigned long options)
        ret = libc.setattrlist(
            path.encode('utf-8'),
            ctypes.byref(attr_list),
            ctypes.byref(ts),
            ctypes.sizeof(ts),
            0
        )
        
        if ret != 0:
            log(f'[Date] setattrlist failed with code {ret}')
        else:
            log(f'[Date] Updated Mac creation time: {path}')

    except Exception as e:
        log(f'[Date] Set Mac file time failed: {e}')

def set_file_time(path, timestamp):
    # Try Windows-specific method first for creation time support
    if sys.platform.startswith('win'):
        try:
            set_win_filetime(path, timestamp)
            return
        except Exception:
            pass
    
    # Try Mac-specific method for creation time support
    if sys.platform == 'darwin':
        set_mac_filetime(path, timestamp)

    # Fallback to standard os.utime (modifies access and modified time)
    # This works on Windows, Mac, Linux
    try:
        os.utime(path, (timestamp, timestamp))
        log(f'[Date] Updated file mtime/atime: {path}')
    except Exception as e:
        log(f'[Date] Set file time failed: {e}')

def parse_exif_time(date_str):
    if not date_str:
        return None
    if isinstance(date_str, bytes):
        try:
            date_str = date_str.decode('utf-8', errors='ignore')
        except:
            return None
    date_str = str(date_str).strip().strip('\x00')
    
    # Try to extract the first 19 characters if longer (ignore subseconds/timezone for now)
    if len(date_str) > 19:
        date_str = date_str[:19]

    formats = [
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y.%m.%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y:%m:%d",
        "%Y-%m-%d"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

def apply_exif_date(path):
    try:
        from PIL import Image
        img = Image.open(path)
        if not hasattr(img, '_getexif'):
            return False
        exif = img._getexif()
        if not exif:
            return False
            
        # 36867: DateTimeOriginal
        # 36868: DateTimeDigitized
        # 306: DateTime
        # 36867 is the most reliable for "shooting time"
        tags = [36867, 36868, 306]
        
        for tag in tags:
            date_str = exif.get(tag)
            dt = parse_exif_time(date_str)
            if dt:
                set_file_time(path, dt.timestamp())
                return True
    except Exception as e:
        log(f'[Date] EXIF read failed for {os.path.basename(path)}: {e}')
        pass
        
    # Fallback: Try to parse date from filename
    try:
        import re
        fname = os.path.basename(path)
        # Patterns:
        # 20231225_120000
        # IMG_20231225_120000
        # 2023-12-25 12.00.00
        # Screenshot_20231225-120000
        patterns = [
            r'(?:IMG_|Screenshot_|^)(\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})', # YYYYMMDD_HHMMSS
            r'(\d{4})-(\d{2})-(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})', # YYYY-MM-DD HH.MM.SS
            r'(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})' # YYYYMMDDHHMMSS
        ]
        
        for pat in patterns:
            m = re.search(pat, fname)
            if m:
                # Groups are always Y, M, D, H, M, S
                parts = [int(x) for x in m.groups()]
                dt = datetime(*parts)
                set_file_time(path, dt.timestamp())
                log(f'[Date] Restored from filename: {fname} -> {dt}')
                return True
    except Exception as e:
        log(f'[Date] Filename parse failed: {e}')
        pass

    return False

try:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    if not os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            f.write('{}')
        log(f'[Metadata] 初始化创建: {METADATA_FILE}')
    else:
        log(f'[Metadata] 已存在: {METADATA_FILE}')
except Exception as e:
    log(f'init metadata error: {e}')

def _read_json(path):
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
    except Exception as e:
        log(f'[Metadata] 读取失败 {path}: {e}')
    return None

def load_metadata():
    data = _read_json(METADATA_FILE)
    if data is not None:
        log(f'[Metadata] 加载成功: {METADATA_FILE}, 共 {len(data)} 条记录')
        return _ensure_groups(data)
    log('[Metadata] 未找到 metadata 文件, 使用空记录')
    return _ensure_groups({})

def save_metadata(data):
    p = METADATA_FILE
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(p):
            os.replace(tmp, p)
        else:
            os.rename(tmp, p)
        log(f'[Metadata] 保存成功: {p}, 共 {len(data)} 条记录')
        return True
    except Exception as e:
        log(f'[Metadata] 保存失败 {p}: {e}')
        return False

# Ensure groups section and file group_id defaults
def _ensure_groups(meta: dict) -> dict:
    try:
        if '__groups__' not in meta or not isinstance(meta.get('__groups__'), dict):
            meta['__groups__'] = {
                'root': {
                    'name': '根分组',
                    'parent_id': None,
                    'created_by': 'system',
                    'mtime': time.time()
                }
            }
        # Default file entries to root group
        for k, v in list(meta.items()):
            if k in ('__groups__', '__texts__', '__debug__'):
                continue
            if isinstance(v, dict) and 'uploader' in v:
                v.setdefault('group_id', 'root')
                meta[k] = v
    except Exception:
        pass
    return meta

def load_users():
    data = _read_json(USERS_FILE)
    if data is not None:
        return data
    return {}

def save_users(data):
    p = USERS_FILE
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(p):
            os.replace(tmp, p)
        else:
            os.rename(tmp, p)
        return True
    except Exception:
        return False

def load_sessions():
    print(f"DEBUG: Loading sessions from {SESSIONS_FILE}")
    log(f"DEBUG: Loading sessions from {SESSIONS_FILE}")
    data = _read_json(SESSIONS_FILE)
    if data is not None:
        print(f"DEBUG: Loaded sessions: {data}")
        log(f"DEBUG: Loaded sessions: {data}")
        return data
    print("DEBUG: No sessions found")
    log("DEBUG: No sessions found")
    return {}

def save_sessions(data):
    p = SESSIONS_FILE
    print(f"DEBUG: Saving sessions to {p}: {data}")
    log(f"DEBUG: Saving sessions to {p}: {data}")
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(p):
            os.replace(tmp, p)
        else:
            os.rename(tmp, p)
        print("DEBUG: Sessions saved successfully")
        log("DEBUG: Sessions saved successfully")
        return True
    except Exception as e:
        print(f"DEBUG: Failed to save sessions: {e}")
        log(f"DEBUG: Failed to save sessions: {e}")
        return False

@app.route('/api/select-folder', methods=['POST'])
def select_folder():
    if not _is_local_request():
        return jsonify({'error': 'forbidden'}), 403
        
    try:
        current_path = app.config.get('UPLOAD_FOLDER')
        
        if sys.platform == 'darwin':
            # Use osascript to open folder picker with default location
            # Escape double quotes in path just in case, though paths usually don't have them
            safe_path = current_path.replace('"', '\\"')
            
            script = f'''
            try
                set defaultLocation to POSIX file "{safe_path}" as alias
            on error
                set defaultLocation to path to desktop
            end try
            set theFolder to choose folder with prompt "选择文件存储位置" default location defaultLocation
            POSIX path of theFolder
            '''
            p = subprocess.Popen(['osascript', '-e', script], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = p.communicate()
            
            if p.returncode == 0:
                path = stdout.decode('utf-8').strip()
                if path and os.path.isdir(path):
                    return jsonify({'path': path})
            
            return jsonify({'error': 'cancelled or invalid'}), 400
            
        elif sys.platform.startswith('win'):
            import tkinter as tk
            from tkinter import filedialog
            
            # Create a hidden root window
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            
            # Open directory chooser
            path = filedialog.askdirectory(initialdir=current_path, title='Select Upload Folder')
            
            root.destroy()
            
            if path:
                path = os.path.normpath(path)
                return jsonify({'path': path})
            
            return jsonify({'error': 'cancelled'}), 400
            
        else:
            return jsonify({'error': 'not supported'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

_SESSIONS = load_sessions() # token -> username

@app.route('/api/user/auth', methods=['POST'])
def user_auth():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    
    if not username or not password:
        return jsonify({'error': 'missing fields'}), 400
        
    users = load_users()
    existing_hash = users.get(username)
    
    if existing_hash:
        # Login: Verify password
        if _check_password_hash(existing_hash, password):
            token = str(uuid.uuid4())
            _SESSIONS[token] = username
            save_sessions(_SESSIONS)
            return jsonify({'message': 'login success', 'token': token, 'username': username})
        else:
            return jsonify({'error': 'auth failed', 'message': '密码错误'}), 401
    else:
        # Register: Create new user
        users[username] = _generate_password_hash(password)
        save_users(users)
        token = str(uuid.uuid4())
        _SESSIONS[token] = username
        save_sessions(_SESSIONS)
        return jsonify({'message': 'registered', 'token': token, 'username': username})

@app.route('/api/user/logout', methods=['POST'])
def user_logout():
    data = request.get_json(silent=True) or {}
    token = data.get('token')
    if token and token in _SESSIONS:
        del _SESSIONS[token]
        save_sessions(_SESSIONS)
    return jsonify({'message': 'logged out'})

@app.route('/api/log', methods=['POST'])
def client_log():
    data = request.get_json(silent=True) or {}
    msg = data.get('message')
    if msg:
        log(f"[CLIENT] {msg}")
    return jsonify({'status': 'ok'})

@app.route('/api/user/me', methods=['POST'])
def user_me():
    data = request.get_json(silent=True) or {}
    token = data.get('token')
    if token and token in _SESSIONS:
        return jsonify({'username': _SESSIONS[token]})
    return jsonify({'error': 'invalid token'}), 401

@app.route('/api/paths')
def debug_paths():
    info = {
        'is_frozen': _IS_FROZEN,
        'exe_dir': os.path.dirname(sys.executable) if _IS_FROZEN else None,
        'data_root': _DATA_ROOT,
        'upload_folder': UPLOAD_FOLDER,
        'metadata_file': METADATA_FILE,
        'metadata_exists': os.path.exists(METADATA_FILE),
        'metadata_size': (os.path.getsize(METADATA_FILE) if os.path.exists(METADATA_FILE) else 0)
    }
    return jsonify(info)

@app.route('/api/debug/write', methods=['POST'])
def debug_write():
    meta = load_metadata()
    meta['__debug__'] = {'uploader': request.form.get('uploader','debug'), 'password_hash': None}
    ok = save_metadata(meta)
    return jsonify({'ok': ok, 'size': (os.path.getsize(METADATA_FILE) if os.path.exists(METADATA_FILE) else 0)})

@app.route('/api/version')
def api_version():
    return jsonify({'version': VERSION})


@app.route('/')
def index():
    # Check for dist/index.html (Vite build output)
    p_dist = os.path.join(STATIC_FOLDER, 'dist', 'index.html')
    if os.path.exists(p_dist):
        resp = send_from_directory(os.path.join(STATIC_FOLDER, 'dist'), 'index.html')
        try:
            resp.cache_control.no_cache = True
            resp.cache_control.no_store = True
            resp.headers['Pragma'] = 'no-cache'
        except Exception:
            pass
        return resp

    # Serve dist/index.html if available
    p_dist = os.path.join(STATIC_FOLDER, 'dist', 'index.html')
    if os.path.exists(p_dist):
        resp = send_from_directory(os.path.join(STATIC_FOLDER, 'dist'), 'index.html')
        try:
            resp.cache_control.no_cache = True
            resp.cache_control.no_store = True
            resp.headers['Pragma'] = 'no-cache'
        except Exception:
            pass
        return resp

    # Legacy check
    p = os.path.join(STATIC_FOLDER, 'index.build.html')
    if os.path.exists(p):
        resp = send_from_directory(STATIC_FOLDER, 'index.build.html')
        try:
            resp.cache_control.no_cache = True
            resp.cache_control.no_store = True
            resp.headers['Pragma'] = 'no-cache'
        except Exception:
            pass
        return resp
    resp = send_from_directory(STATIC_FOLDER, 'index.html')
    try:
        resp.cache_control.no_cache = True
        resp.cache_control.no_store = True
        resp.headers['Pragma'] = 'no-cache'
    except Exception:
        pass
    return resp

@app.route('/static/<path:filename>')
def serve_static(filename):
    response = send_from_directory(STATIC_FOLDER, filename)
    if filename.endswith('.js'):
        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    elif filename.endswith('.css'):
        response.headers['Content-Type'] = 'text/css; charset=utf-8'
    return response

@app.route('/dist/assets/<path:filename>')
def serve_dist_assets(filename):
    response = send_from_directory(os.path.join(STATIC_FOLDER, 'dist', 'assets'), filename)
    if filename.endswith('.js'):
        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    elif filename.endswith('.css'):
        response.headers['Content-Type'] = 'text/css; charset=utf-8'
    return response

@app.route('/<path:filename>')
def serve_root_static(filename):
    # Serve CSS, JS, and other static files from root path
    if filename in ['style.css', 'script.js']:
        response = send_from_directory(STATIC_FOLDER, filename)
        if filename.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
        elif filename.endswith('.css'):
            response.headers['Content-Type'] = 'text/css; charset=utf-8'
        return response
    return send_from_directory(STATIC_FOLDER, filename)

@app.route('/favicon.ico')
def favicon():
    fav_path = os.path.join(STATIC_FOLDER, 'favicon.ico')
    if os.path.exists(fav_path):
        return send_from_directory(STATIC_FOLDER, 'favicon.ico')
    root_dir = (os.path.dirname(sys.executable) if _IS_FROZEN else _PROJECT_ROOT)
    alt_name = 'logo.ico'
    alt_path = os.path.join(root_dir, alt_name)
    if os.path.exists(alt_path):
        return send_from_directory(root_dir, alt_name)
    return ('', 204)

@app.route('/api/ip')
def api_ip():
    try:
        env_ip = os.environ.get('HOST_IP') or os.environ.get('LAN_IP')
        forwarded_host = request.headers.get('X-Forwarded-Host')
        forwarded_port = request.headers.get('X-Forwarded-Port')
        forwarded_proto = request.headers.get('X-Forwarded-Proto')
        host = (forwarded_host or request.host or '').strip()
        ip = host
        port = None
        if host:
            if host.startswith('['):
                i = host.find(']')
                if i != -1:
                    ip = host[1:i]
                    rest = host[i+1:]
                    if rest.startswith(':'):
                        try:
                            port = int(rest[1:])
                        except Exception:
                            port = None
            else:
                parts = host.split(':')
                ip = parts[0]
                if len(parts) > 1:
                    try:
                        port = int(parts[1])
                    except Exception:
                        port = None
        
        if env_ip:
            ip = env_ip

        if port is None:
            try:
                port = int(forwarded_port) if forwarded_port else GLOBAL_PORT
            except Exception:
                port = GLOBAL_PORT
        
        # Fix: If we are running locally and detected localhost/127.0.0.1, 
        # try to return the actual LAN IP so other devices can connect.
        if ip in ('127.0.0.1', 'localhost', '::1'):
            lan_ip = get_local_ip_fast()
            if lan_ip and lan_ip != '127.0.0.1':
                ip = lan_ip

        return jsonify({
            'ip': ip,
            'port': port,
            'proto': (forwarded_proto or request.scheme or 'http'),
            'is_host': _is_local_request(),
            'mode': _config.get('mode', 'share'),
            'use_source_date': _config.get('use_source_date', False),
            'upload_dir': app.config['UPLOAD_FOLDER'],
            'allow_remote_group_create': _config.get('allow_remote_group_create', True),
            'version': VERSION
        })
    except Exception:
        return jsonify({
            'ip': get_local_ip_fast(),
            'port': GLOBAL_PORT,
            'proto': (request.scheme or 'http'),
            'is_host': _is_local_request(),
            'mode': _config.get('mode', 'share'),
            'use_source_date': _config.get('use_source_date', False),
            'upload_dir': app.config['UPLOAD_FOLDER'],
            'allow_remote_group_create': _config.get('allow_remote_group_create', True),
            'version': VERSION
        })

@app.route('/api/config', methods=['POST'])
def api_config():
    global UPLOAD_FOLDER
    if not _is_local_request():
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json(silent=True) or {}
    changed = False
    
    log(f'[配置] 收到配置更新请求: {data.keys()}')

    if 'mode' in data:
        _config['mode'] = data['mode']
        changed = True
        log(f'[配置] 传输模式已更改为: {data["mode"]}')

    if 'use_source_date' in data:
        _config['use_source_date'] = bool(data['use_source_date'])
        changed = True

        
    # Check for both 'upload_folder' (legacy/backend) and 'upload_dir' (frontend)
    new_path = data.get('upload_folder') or data.get('upload_dir')
    
    if new_path:
        old_path = app.config.get('UPLOAD_FOLDER', '')
        # Basic validation
        if os.path.exists(new_path) and os.path.isdir(new_path):
            _config['upload_folder'] = new_path
            app.config['UPLOAD_FOLDER'] = new_path
            UPLOAD_FOLDER = new_path  # Update global variable as well
            changed = True
            log(f'[配置] 上传文件夹已更改: {old_path} -> {new_path}')
            log(f'[配置] 验证 - app.config["UPLOAD_FOLDER"]: {app.config["UPLOAD_FOLDER"]}')
            log(f'[配置] 验证 - UPLOAD_FOLDER 全局变量: {UPLOAD_FOLDER}')
        else:
            log(f'[配置] 上传文件夹路径无效: {new_path}')
            return jsonify({'error': 'invalid path'}), 400
            
    # allow_remote_group_create
    if 'allow_remote_group_create' in data:
        _config['allow_remote_group_create'] = bool(data.get('allow_remote_group_create'))
        changed = True

    if changed:
        save_config(_config)
        log(f'[配置] 配置已保存到文件')
        
    return jsonify({'message': 'ok', 'config': _config})

@app.route('/api/open', methods=['POST'])
def api_open():
    if not _is_local_request():
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json(silent=True) or {}
    path = data.get('path')
    reveal = data.get('reveal', False)
    
    target = app.config['UPLOAD_FOLDER']
    if path:
        target = os.path.join(target, path)
        
    if not os.path.exists(target):
        return jsonify({'error': 'not found'}), 404
        
    try:
        if sys.platform == 'darwin':
            cmd = ['open']
            if reveal:
                cmd.append('-R')
            cmd.append(target)
            subprocess.call(cmd)
        elif sys.platform == 'win32':
            if reveal:
                subprocess.call(['explorer', f'/select,{target}'])
            else:
                os.startfile(target)
        else:
            # Linux
            subprocess.call(['xdg-open', target])
        return jsonify({'message': 'opened'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _is_local_request():
    try:
        ra = request.remote_addr or ''
        local_ip = get_local_ip()
        return ra in ('127.0.0.1', '::1', local_ip)
    except Exception:
        return False

@app.route('/api/exit', methods=['POST'])
def api_exit():
    if not _is_local_request():
        return jsonify({'error': 'forbidden'}), 403
    def _do_kill():
        try:
            func = request.environ.get('werkzeug.server.shutdown')
            if func:
                try:
                    func()
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(0.2)
        try:
            os._exit(0)
        except Exception:
            pass
        try:
            import subprocess, os as _os
            subprocess.Popen(['taskkill', '/F', '/PID', str(_os.getpid())], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    threading.Thread(target=_do_kill, daemon=True).start()
    return jsonify({'message': 'shutting down'})

@app.route('/api/zip/list', methods=['POST'])
def list_zip_contents():
    data = request.get_json(silent=True) or {}
    filename = data.get('filename')
    password = data.get('password')
    
    if not filename:
        return jsonify({'error': 'filename required'}), 400
        
    meta = load_metadata()
    entry = meta.get(filename, {})
    
    # Check ownership/access logic if needed, but mainly password
    password_hash = entry.get('password_hash')
    if password_hash:
        if not password or not _check_password_hash(password_hash, password):
             return jsonify({'error': 'password required'}), 403

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'not found'}), 404
        
    try:
        if not zipfile.is_zipfile(file_path):
             return jsonify({'error': 'not a zip file'}), 400
             
        with zipfile.ZipFile(file_path, 'r') as zf:
            files = []
            for info in zf.infolist():
                # Decode filename if it's not utf-8 (common issue with zip files created on Windows/CN)
                # zipfile handles cp437, but for Chinese characters it might be tricky. 
                # Python 3 zipfile attempts to decode.
                fname = info.filename
                try:
                    # Attempt to fix encoding if it looks like mojibake (cp437 vs gbk/utf8)
                    # This is a common hack for zips
                    if info.flag_bits & 0x800:
                        # UTF-8 flag is set, should be fine
                        pass
                    else:
                        # Try interpreting as cp437 then re-encoding to gbk/utf-8?
                        # Usually python's zipfile uses cp437 by default if flag is not set.
                        # For now, trust standard behavior or maybe just send raw string.
                        # A simple heuristic is often messy. Let's stick to info.filename first.
                        # If users report issues, we can fix.
                        # Actually, let's try to decode as cp437 and encode to gbk if needed? 
                        # No, let's keep it simple for now.
                        pass
                except:
                    pass

                files.append({
                    'name': fname,
                    'size': info.file_size,
                    'date': datetime(*info.date_time).strftime('%Y-%m-%d %H:%M:%S') if info.date_time else ''
                })
            # Sort by name (directories first maybe?)
            files.sort(key=lambda x: x['name'])
            return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET', 'POST'])
def handle_files():
    if request.method == 'POST':
        files = request.files.getlist('file')
        if not files:
            return jsonify({'error': 'No file part'}), 400
        saved = []
        uploader = request.form.get('uploader', '')
        password = request.form.get('password', '')
        group_id = (request.form.get('group_id') or 'root').strip() or 'root'
        meta = load_metadata()
        total_bytes = 0
        try:
            current_upload_folder = app.config['UPLOAD_FOLDER']
            log(f'[上传] 使用上传文件夹: {current_upload_folder}')
            for file in files:
                if not file or file.filename == '':
                    continue
                raw_name = file.filename or ''
                base_name = os.path.basename(raw_name)
                base_name = ''.join(ch for ch in base_name if ch not in '\\/:*?"<>|')
                filename = base_name.strip()
                if not filename or filename in ('.','..'):
                    b, e = os.path.splitext(base_name)
                    ts = str(int(time.time()*1000))
                    safe_base = (b or 'file_' + ts).strip() or ('file_' + ts)
                    safe_ext = e.replace('.', '')
                    filename = safe_base + (('.' + safe_ext) if safe_ext else '')
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(save_path)
                try:
                    total_bytes += int(os.path.getsize(save_path))
                except Exception:
                    pass
                if _config.get('use_source_date'):
                    apply_exif_date(save_path)
                log(f'[上传] 文件: {filename}, 保存路径: {save_path}, 账号: "{uploader}", 密码: {"已设置" if password else "未设置"}')
                entry = {'uploader': uploader, 'password_hash': None, 'group_id': group_id}
                if password:
                    entry['password_hash'] = _generate_password_hash(password)
                meta[filename] = entry
                saved.append(filename)
            if saved:
                save_metadata(meta)
                log(f'[上传] Metadata 已保存: {len(saved)} 个条目')
                track_event('file_upload', {'status': 'success', 'file_count': len(saved), 'total_bytes': total_bytes})
                return jsonify({'message': 'ok', 'saved': saved}), 201
            return jsonify({'error': 'No selected file'}), 400
        except Exception as e:
            track_event('file_upload', {'status': 'fail', 'file_count': len(saved), 'total_bytes': total_bytes, 'error': str(e)[:200]})
            return jsonify({'error': 'upload failed'}), 500
    
    files = []
    meta = load_metadata()

    if _config.get('mode') == 'oneway' and not _is_local_request():
        return jsonify([])

    upload_folder = app.config['UPLOAD_FOLDER']
    q = (request.args.get('q') or '').strip().lower()
    group_filter = (request.args.get('group_id') or '').strip()
    if os.path.exists(upload_folder):
        for f in os.listdir(upload_folder):
            file_path = os.path.join(upload_folder, f)
            if f.lower() == os.path.basename(METADATA_FILE).lower():
                continue
            if os.path.isfile(file_path):
                size = os.path.getsize(file_path)
                mtime = os.path.getmtime(file_path)
                entry = meta.get(f, {})
                files.append({
                    'name': f,
                    'size': size,
                    'mtime': mtime,
                    'uploader': entry.get('uploader', ''),
                    'has_password': bool(entry.get('password_hash')),
                    'group_id': entry.get('group_id', 'root')
                })
    files.sort(key=lambda x: x['mtime'], reverse=True)
    # Filter by group if provided
    if group_filter:
        files = [it for it in files if (it.get('group_id') or 'root') == group_filter]
    # Fuzzy search if q provided
    if q:
        def _score(name: str, q: str) -> float:
            try:
                if q in name:
                    return 1.0
                return difflib.SequenceMatcher(None, name, q).ratio()
            except Exception:
                return 0.0
        files = [it for it in files if _score((it.get('name','').lower()), q) >= 0.5]
    if not _is_local_request():
        groups = meta.get('__groups__', {})
        hidden_ids = {gid for gid, g in groups.items() if g.get('hidden')}
        if hidden_ids:
            files = [it for it in files if (it.get('group_id') or 'root') not in hidden_ids]
    return jsonify(files)

@app.route('/api/texts', methods=['GET','POST'])
def handle_texts():
    meta = load_metadata()
    if request.method == 'POST':
        try:
            data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
            log({'route':'/api/texts','method':'POST','is_json':bool(request.is_json),'has_form':bool(request.form),'data_keys':list(data.keys())})
            content = (data.get('content') or '').strip()
            uploader_name = (data.get('uploader_name') or data.get('uploader') or '').strip()
            uploader_id = (data.get('uploader_id') or '').strip()
            password = data.get('password') or ''
            if not content:
                return jsonify({'error': 'no content'}), 400
            meta.setdefault('__texts__', {})
            tid = str(int(time.time()*1000))
            while tid in meta['__texts__']:
                tid = str(int(time.time()*1000)+1)
            entry = {
                'content': content,
                'uploader': uploader_name,
                'uploader_id': (uploader_id or None),
                'password_hash': None,
                'mtime': time.time()
            }
            if password:
                entry['password_hash'] = generate_password_hash(password, method='pbkdf2:sha256')
            meta['__texts__'][tid] = entry
            save_metadata(meta)
            track_event('text_share', {'status': 'success', 'text_length': len(content)})
            return jsonify({'id': tid}), 201
        except Exception as e:
            try:
                log({'route':'/api/texts','error':str(e)})
            except Exception:
                pass
            track_event('text_share', {'status': 'fail', 'error': str(e)[:200]})
            return jsonify({'error':'internal'}), 500
    items = []
    if _config.get('mode') == 'oneway' and not _is_local_request():
        return jsonify([])

    texts = meta.get('__texts__', {})
    for tid, entry in texts.items():
        has_pwd = bool(entry.get('password_hash'))
        item = {
            'id': tid,
            'uploader': entry.get('uploader',''),
            'uploader_id': entry.get('uploader_id') or None,
            'mtime': entry.get('mtime') or time.time(),
            'has_password': has_pwd
        }
        if not has_pwd:
            item['content'] = entry.get('content','')
        items.append(item)
    items.sort(key=lambda x: x['mtime'], reverse=True)
    return jsonify(items)

@app.route('/api/texts/<path:tid>', methods=['GET','DELETE'])
def text_item_api(tid):
    meta = load_metadata()
    texts = meta.get('__texts__', {})
    entry = texts.get(tid)
    if not entry:
        return jsonify({'error': 'not found'}), 404
    if request.method == 'GET':
        password_hash = entry.get('password_hash')
        if password_hash:
            pwd = request.args.get('password','')
            if not pwd or not _check_password_hash(password_hash, pwd):
                return jsonify({'error':'password required'}), 403
        return jsonify({'content': entry.get('content','')})
    uploader_id = None
    uploader_name = None
    if request.is_json:
        data = request.get_json(silent=True) or {}
        uploader_id = data.get('uploader_id')
        uploader_name = data.get('uploader_name') or data.get('uploader')
    else:
        uploader_id = request.form.get('uploader_id') or request.args.get('uploader_id')
        uploader_name = request.form.get('uploader_name') or request.form.get('uploader') or request.args.get('uploader_name') or request.args.get('uploader')
    owner_id = entry.get('uploader_id') or ''
    owner_name = entry.get('uploader','')
    if not _is_local_request():
        if owner_id:
            if (uploader_id or '') != owner_id:
                return jsonify({'error':'not owner'}), 403
        elif owner_name:
            if (uploader_name or '') != owner_name:
                return jsonify({'error':'not owner'}), 403
    texts.pop(tid, None)
    meta['__texts__'] = texts
    save_metadata(meta)
    return jsonify({'message':'deleted'})

@app.route('/api/texts/clear', methods=['DELETE'])
def clear_texts_api():
    if not _is_local_request():
        return jsonify({'error':'forbidden'}), 403
    meta = load_metadata()
    meta['__texts__'] = {}
    save_metadata(meta)
    return jsonify({'message':'cleared'})

@app.route('/api/texts/<path:tid>/password', methods=['POST','DELETE'])
def set_text_password(tid):
    meta = load_metadata()
    texts = meta.get('__texts__', {})
    entry = texts.get(tid)
    if not entry:
        return jsonify({'error':'not found'}), 404
    data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
    try:
        log({'route':f'/api/texts/{tid}/password','method':request.method,'is_json':bool(request.is_json),'has_form':bool(request.form),'data_keys':list(data.keys())})
    except Exception:
        pass
    uploader_id = (data.get('uploader_id') or request.form.get('uploader_id') or request.args.get('uploader_id') or '')
    uploader_name = (data.get('uploader_name') or data.get('uploader') or request.form.get('uploader_name') or request.form.get('uploader') or request.args.get('uploader_name') or request.args.get('uploader') or '')
    owner_id = entry.get('uploader_id') or ''
    owner_name = entry.get('uploader','')
    if not _is_local_request():
        if owner_id:
            if uploader_id != owner_id:
                return jsonify({'error':'not owner'}), 403
        elif owner_name:
            if uploader_name != owner_name:
                return jsonify({'error':'not owner'}), 403
    if request.method == 'DELETE':
        entry['password_hash'] = None
        texts[tid] = entry
        meta['__texts__'] = texts
        save_metadata(meta)
        return jsonify({'message':'password cleared'})
    pwd = data.get('password') or request.form.get('password') or request.args.get('password')
    if not pwd:
        return jsonify({'error':'no password'}), 400
    entry['password_hash'] = _generate_password_hash(pwd)
    texts[tid] = entry
    meta['__texts__'] = texts
    save_metadata(meta)
    return jsonify({'message':'password set'})

# --- Groups API ---
@app.route('/api/groups', methods=['GET','POST'])
def api_groups():
    meta = load_metadata()
    groups = meta.get('__groups__', {})
    if request.method == 'POST':
        data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
        name = (data.get('name') or '').strip()
        parent_id = (data.get('parent_id') or 'root').strip() or 'root'
        if not name:
            return jsonify({'error':'name required'}), 400
        if not _is_local_request() and not _config.get('allow_remote_group_create', True):
            return jsonify({'error':'remote create disabled'}), 403
        gid = uuid.uuid4().hex
        groups[gid] = {
            'name': name,
            'parent_id': parent_id,
            'created_by': request.remote_addr or '',
            'mtime': time.time(),
            'hidden': False,
            'is_pinned': False
        }
        meta['__groups__'] = groups
        save_metadata(meta)
        return jsonify({'id': gid}), 201
    # GET
    items = []
    visible_ids = set(groups.keys())
    if not _is_local_request():
        visible_ids = {gid for gid, g in groups.items() if not g.get('hidden')}
    children = {}
    for _id in visible_ids:
        g = groups[_id]
        pid = g.get('parent_id') or None
        if pid and pid not in visible_ids:
            pid = None
        children.setdefault(pid, []).append(_id)
    for _id in visible_ids:
        g = groups[_id]
        items.append({
            'id': _id,
            'name': g.get('name',''),
            'parent_id': (g.get('parent_id') if (g.get('parent_id') in visible_ids or g.get('parent_id') is None) else None),
            'mtime': g.get('mtime') or time.time(),
            'children': children.get(_id, []),
            'hidden': bool(g.get('hidden')),
            'is_pinned': bool(g.get('is_pinned'))
        })
    return jsonify(items)

@app.route('/api/groups/<path:gid>', methods=['PUT'])
def api_group_update(gid):
    if not _is_local_request():
        return jsonify({'error':'forbidden'}), 403
    meta = load_metadata()
    groups = meta.get('__groups__', {})
    if gid not in groups:
        return jsonify({'error':'not found'}), 404
    
    data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
    g = groups[gid]
    
    if 'name' in data:
        name = str(data['name']).strip()
        if not name: return jsonify({'error':'name required'}), 400
        g['name'] = name
    
    if 'parent_id' in data:
        pid = str(data['parent_id']).strip()
        if pid != 'root' and pid not in groups:
            return jsonify({'error':'invalid parent'}), 400
        if pid == gid:
             return jsonify({'error':'cannot be own parent'}), 400
        # Prevent cycles (simple check)
        curr = pid
        while curr and curr != 'root':
            if curr == gid:
                return jsonify({'error':'cycle detected'}), 400
            curr = groups.get(curr, {}).get('parent_id')
        g['parent_id'] = pid

    if 'is_pinned' in data:
        g['is_pinned'] = bool(data['is_pinned'])

    g['mtime'] = time.time()
    groups[gid] = g
    meta['__groups__'] = groups
    save_metadata(meta)
    return jsonify({'message':'updated'})

@app.route('/api/groups/<path:gid>', methods=['DELETE'])
def api_group_delete(gid):
    if not _is_local_request():
        return jsonify({'error':'forbidden'}), 403
    mode = (request.args.get('mode') or (request.get_json(silent=True) or {}).get('mode') or 'delete_only').strip()
    meta = load_metadata()
    groups = meta.get('__groups__', {})
    if gid not in groups or gid == 'root':
        return jsonify({'error':'not found'}), 404
    parent_id = groups[gid].get('parent_id') or 'root'
    # reparent child groups to parent
    for _id, g in list(groups.items()):
        if g.get('parent_id') == gid:
            g['parent_id'] = parent_id
            g['mtime'] = time.time()
            groups[_id] = g
    # handle direct files of this group
    if mode == 'delete_with_files':
        upload_folder = app.config['UPLOAD_FOLDER']
        for fname, entry in list(meta.items()):
            if fname in ('__groups__','__texts__','__debug__'):
                continue
            if isinstance(entry, dict) and entry.get('group_id') == gid:
                try:
                    p = os.path.join(upload_folder, fname)
                    if os.path.exists(p) and os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
                meta.pop(fname, None)
    else:
        for fname, entry in list(meta.items()):
            if fname in ('__groups__','__texts__','__debug__'):
                continue
            if isinstance(entry, dict) and entry.get('group_id') == gid:
                entry['group_id'] = parent_id
                meta[fname] = entry
    groups.pop(gid, None)
    meta['__groups__'] = groups
    save_metadata(meta)
    return jsonify({'message':'deleted','mode':mode})

@app.route('/api/files/<path:filename>/group', methods=['POST'])
def api_set_file_group(filename):
    meta = load_metadata()
    entry = meta.get(filename)
    if filename.lower() == os.path.basename(METADATA_FILE).lower():
        return jsonify({'error': 'protected'}), 403

    if not entry:
        # Check if file exists on disk (in case it wasn't in metadata yet)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            # Create default entry
            entry = {'uploader': '', 'password_hash': None, 'group_id': 'root'}
        else:
            log(f'[移动] 失败: 文件未找到 {filename}')
            return jsonify({'error':'not found'}), 404
    data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
    gid = (data.get('group_id') or '').strip() or 'root'
    groups = meta.get('__groups__', {})
    if gid != 'root' and gid not in groups:
        log(f'[移动] 失败: 分组无效 {gid}')
        return jsonify({'error':'invalid group'}), 400
    entry['group_id'] = gid
    meta[filename] = entry
    save_metadata(meta)
    log(f'[移动] 成功: {filename} -> {gid}')
    return jsonify({'message':'moved','group_id':gid})

@app.route('/api/groups/<path:gid>/hidden', methods=['POST'])
def api_group_hidden(gid):
    if not _is_local_request():
        return jsonify({'error':'forbidden'}), 403
    meta = load_metadata()
    groups = meta.get('__groups__', {})
    g = groups.get(gid)
    if not g:
        return jsonify({'error':'not found'}), 404
    data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
    hidden = bool(data.get('hidden'))
    g['hidden'] = hidden
    g['mtime'] = time.time()
    groups[gid] = g
    meta['__groups__'] = groups
    save_metadata(meta)
    return jsonify({'message':'ok','hidden':hidden})

@app.route('/api/files/<path:filename>', methods=['DELETE'])
def delete_file_api(filename):
    if filename.lower() == os.path.basename(METADATA_FILE).lower():
        return jsonify({'error': 'protected'}), 403
    uploader = None
    if request.is_json:
        data = request.get_json(silent=True) or {}
        uploader = data.get('uploader')
    else:
        uploader = request.form.get('uploader') or request.args.get('uploader')
    meta = load_metadata()
    entry = meta.get(filename, {})
    owner = entry.get('uploader', '')
    if owner and uploader != owner and not _is_local_request():
        return jsonify({'error': 'not owner'}), 403
    try:
        os.remove(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    except FileNotFoundError:
        pass
    if filename in meta:
        meta.pop(filename)
        save_metadata(meta)
    return jsonify({'message': 'deleted'})

@app.route('/download/<path:filename>')
def download_file(filename):
    if filename.lower() == os.path.basename(METADATA_FILE).lower():
        return jsonify({'error': 'protected'}), 403
    meta = load_metadata()
    entry = meta.get(filename, {})
    password_hash = entry.get('password_hash')
    log(f'[下载] 文件: {filename}, 有密码: {bool(password_hash)}')
    if password_hash:
        pwd = request.args.get('password', '')
        log(f'[下载] 收到密码: {bool(pwd)}')
        if not pwd or not _check_password_hash(password_hash, pwd):
            return jsonify({'error': 'password required'}), 403
    
    is_preview = request.args.get('preview', '').lower() == 'true'
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=not is_preview)

# --- Office Preview Support (conversion and cache) ---
CACHE_ROOT = os.path.join(_DATA_ROOT, 'QuickSend', 'cache')
OFFICE_CACHE = os.path.join(CACHE_ROOT, 'office')
os.makedirs(OFFICE_CACHE, exist_ok=True)

def _find_soffice():
    p = os.environ.get('SOFFICE_PATH')
    candidates = [
        p,
        r"C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        r"C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        'soffice'
    ]
    for c in candidates:
        try:
            if not c:
                continue
            if os.path.isabs(c) and os.path.exists(c):
                return c
            # Try which for non-abs commands
            if c == 'soffice':
                from shutil import which
                w = which('soffice')
                if w:
                    return w
        except Exception:
            pass
    return None

def _convert_office(src_path, ext):
    base = os.path.basename(src_path)
    name_no_ext = os.path.splitext(base)[0]
    soffice = _find_soffice()
    if soffice:
        try:
            # Prefer HTML for doc, PDF for ppt
            fmt = 'html' if ext in ('doc',) else 'pdf'
            subprocess.run([soffice, '--headless', '--convert-to', fmt, '--outdir', OFFICE_CACHE, src_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
            out_file = os.path.join(OFFICE_CACHE, f"{name_no_ext}.{fmt}")
            if os.path.exists(out_file):
                return {'type': fmt, 'path': out_file}
        except Exception:
            pass
        try:
            # Fallback to PDF if HTML failed
            fmt = 'pdf'
            subprocess.run([soffice, '--headless', '--convert-to', fmt, '--outdir', OFFICE_CACHE, src_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
            out_file = os.path.join(OFFICE_CACHE, f"{name_no_ext}.pdf")
            if os.path.exists(out_file):
                return {'type': fmt, 'path': out_file}
        except Exception:
            pass
    return None

@app.route('/api/office/preview', methods=['POST'])
def api_office_preview():
    data = request.get_json(silent=True) or {}
    filename = data.get('filename')
    password = data.get('password')
    if not filename:
        return jsonify({'error': 'filename required'}), 400
    src_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(src_path):
        return jsonify({'error': 'not found'}), 404
    ext = os.path.splitext(filename)[1].lower().strip('.')
    if ext in ('doc', 'ppt', 'pptx'):
        # Respect password if set (not implemented for office preview yet)
        res = _convert_office(src_path, ext)
        if res:
            rel = os.path.relpath(res['path'], CACHE_ROOT).replace('\\','/')
            return jsonify({'type': res['type'], 'url': f"/cache/{rel}"})
        return jsonify({'error': 'converter not available'}), 500
    return jsonify({'error': 'unsupported'}), 400

@app.route('/cache/<path:filename>')
def serve_cache(filename):
    return send_from_directory(CACHE_ROOT, filename)

@app.route('/api/files/<path:filename>/password', methods=['POST', 'DELETE'])
def set_file_password(filename):
    meta = load_metadata()
    data = (request.get_json(silent=True) or (request.form.to_dict() if request.form else {}) or {})
    try:
        log({'route':f'/api/files/{filename}/password','method':request.method,'is_json':bool(request.is_json),'has_form':bool(request.form),'data_keys':list(data.keys())})
    except Exception:
        pass
    uploader = data.get('uploader') or request.form.get('uploader') or request.args.get('uploader') or ''
    entry = meta.get(filename, {})
    owner = entry.get('uploader', '')
    if owner and uploader != owner and not _is_local_request():
        return jsonify({'error': 'not owner'}), 403
    if request.method == 'DELETE':
        if filename in meta:
            meta[filename]['password_hash'] = None
            save_metadata(meta)
        return jsonify({'message': 'password cleared'})
    pwd = data.get('password') or request.form.get('password') or request.args.get('password')
    if not pwd:
        return jsonify({'error': 'no password'}), 400
    if filename not in meta:
        meta[filename] = {'uploader': uploader, 'password_hash': None}
    meta[filename]['password_hash'] = _generate_password_hash(pwd)
    save_metadata(meta)
    return jsonify({'message': 'password set'})

def open_browser():
    url = f'http://localhost:{GLOBAL_PORT}'
    deadline = time.time() + 5
    try:
        import urllib.request
        while time.time() < deadline:
            try:
                urllib.request.urlopen(url, timeout=0.5)
                break
            except Exception:
                time.sleep(0.2)
    except Exception:
        time.sleep(0.5)
    webbrowser.open(url)

if __name__ == '__main__':
    # Decide port: Prefer PORT env, but fallback to scanning if busy
    # This ensures that even if a specific port is requested (via env), 
    # we still avoid conflicts by searching for the next available one.
    try:
        env_port = os.environ.get('PORT')
        start_p = int(env_port) if env_port else 5000
        # Scan next 100 ports starting from preferred
        GLOBAL_PORT = find_free_port(start_p, start_p + 100)
    except Exception:
        GLOBAL_PORT = 5000

    try:
        if sys.platform.startswith('win'):
            import subprocess
            rule_name = f'QuickSend-{GLOBAL_PORT}'
            subprocess.run(['netsh','advfirewall','firewall','delete','rule',f'name={rule_name}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['netsh','advfirewall','firewall','add','rule',f'name={rule_name}','dir=in','action=allow','protocol=TCP',f'localport={GLOBAL_PORT}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            log(f'[网络] 防火墙端口开放: {GLOBAL_PORT}')
    except Exception as _e:
        log(f'[网络] 尝试开放防火墙端口失败: {GLOBAL_PORT}, {str(_e)}')

    if INSTALLATION_CREATED:
        track_event('install', {'status': 'created'})
    track_event('app_open', {'start_ms': int((time.time()-START_TIME)*1000)})
    
    log('[启动] 服务准备')
    log(f"[启动] 耗时: {int((time.time()-START_TIME)*1000)}ms, 端口: {GLOBAL_PORT}")

    def start_flask():
        app.run(host='0.0.0.0', port=GLOBAL_PORT, debug=False, threaded=True, use_reloader=False)

    # Check if we should run headless (e.g. server mode)
    headless = os.environ.get('HEADLESS', '').lower() in ('1', 'true', 'yes')
    
    if headless:
        start_flask()
    else:
        # Start Flask in background thread
        t = threading.Thread(target=start_flask, daemon=True)
        t.start()
        
        try:
            import webview
            # Create native window
            webview.create_window('QuickSend', f'http://127.0.0.1:{GLOBAL_PORT}', width=1100, height=800, resizable=True)
            
            # Ensure storage persistence
            data_dir = os.path.join(_DATA_ROOT, 'QuickSend', 'webview_data')
            os.makedirs(data_dir, exist_ok=True)
            
            webview.start(private_mode=False, storage_path=data_dir)
            # When window closes, exit the app
            os._exit(0)
        except ImportError:
            # Fallback to browser
            threading.Thread(target=open_browser).start()
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass

import json
import os
import queue
import threading
import urllib.request
import sys
import ssl
import hashlib


class SupabaseAnalytics:
    def __init__(self):
        self._enabled = str(os.environ.get('SUPABASE_ANALYTICS_ENABLED', '1')).lower() in ('1', 'true', 'yes', 'on')
        self._last_error = ''
        self._config_path = ''
        self._logger = None
        self._disabled_logged = False
        self._ssl_context = None
        self._last_response_code = None
        self._last_response_body = ''
        self._success_logged = False
        self._last_request_method = None
        self._last_request_url = ''
        self._last_request_has_apikey = False
        self._last_request_has_authorization = False
        cfg = self._load_config()
        self._url_base = self._normalize_supabase_url((os.environ.get('SUPABASE_URL') or cfg.get('supabase_url') or ''))
        self._anon_key = self._normalize_anon_key((os.environ.get('SUPABASE_ANON_KEY') or cfg.get('supabase_anon_key') or ''))
        self._schema = os.environ.get('SUPABASE_ANALYTICS_SCHEMA') or 'quicksend_analytics'
        self._table = os.environ.get('SUPABASE_ANALYTICS_TABLE') or 'events_raw_v1'
        self._q = queue.Queue(maxsize=200)
        self._started = False
        self._lock = threading.Lock()
        try:
            import certifi
            cafile = certifi.where()
            if cafile:
                self._ssl_context = ssl.create_default_context(cafile=cafile)
        except Exception:
            self._ssl_context = None

    def enabled(self) -> bool:
        return bool(self._enabled and self._url_base and self._anon_key)

    def set_logger(self, logger):
        self._logger = logger

    def _strip_wrapping_quotes(self, s: str) -> str:
        v = (s or '').strip()
        for _ in range(2):
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1].strip()
        return v

    def _normalize_supabase_url(self, raw: str) -> str:
        v = self._strip_wrapping_quotes(raw)
        v = v.rstrip('/')
        for marker in ('/functions/v1/', '/functions/'):
            i = v.find(marker)
            if i != -1:
                v = v[:i].rstrip('/')
                break
        return v

    def _normalize_anon_key(self, raw: str) -> str:
        v = self._strip_wrapping_quotes(raw)
        if v.lower().startswith('bearer '):
            v = v[7:].strip()
        return v

    def _anon_key_fingerprint(self) -> str:
        try:
            if not self._anon_key:
                return ''
            h = hashlib.sha256(self._anon_key.encode('utf-8', errors='ignore')).hexdigest()
            return h[:12]
        except Exception:
            return ''

    def status(self) -> dict:
        try:
            api_url = (f"{self._url_base}/functions/v1/quicksend-analytics-ingest" if self._url_base else '')
            return {
                'enabled': bool(self.enabled()),
                'enabled_flag': bool(self._enabled),
                'has_supabase_url': bool(self._url_base),
                'has_anon_key': bool(self._anon_key),
                'anon_key_fingerprint': self._anon_key_fingerprint(),
                'anon_key_len': (len(self._anon_key) if self._anon_key else 0),
                'supabase_url': (self._url_base or ''),
                'api_url': api_url,
                'config_path': (self._config_path or ''),
                'last_error': (self._last_error or ''),
                'last_request_method': self._last_request_method,
                'last_request_url': (self._last_request_url or ''),
                'last_request_has_apikey': bool(self._last_request_has_apikey),
                'last_request_has_authorization': bool(self._last_request_has_authorization),
                'last_response_code': self._last_response_code,
                'last_response_body': (self._last_response_body or '')[:500],
            }
        except Exception:
            return {'enabled': False}

    def track(self, event: dict):
        if not self.enabled():
            if not self._disabled_logged:
                self._disabled_logged = True
                try:
                    if not self._enabled:
                        self._last_error = 'disabled_by_flag'
                    elif not self._url_base:
                        self._last_error = 'missing_supabase_url'
                    elif not self._anon_key:
                        self._last_error = 'missing_supabase_anon_key'
                    if self._logger:
                        self._logger(f"[Analytics] disabled: {self.status()}")
                except Exception:
                    pass
            return
        try:
            self._start_worker()
            self._q.put_nowait(event)
        except Exception:
            pass

    def _load_config(self) -> dict:
        path = os.environ.get('QUICKSEND_ANALYTICS_CONFIG_PATH') or ''
        candidates = []
        if path:
            candidates.append(path)
        try:
            meipass = getattr(sys, '_MEIPASS', None)
            if meipass:
                candidates.append(os.path.join(meipass, 'analytics_config.json'))
        except Exception:
            pass
        try:
            candidates.append(os.path.join(os.path.dirname(sys.executable), 'analytics_config.json'))
        except Exception:
            pass
        try:
            if sys.platform == 'darwin':
                candidates.append(os.path.realpath(os.path.join(os.path.dirname(sys.executable), '..', 'Resources', 'analytics_config.json')))
        except Exception:
            pass
        try:
            if sys.platform == 'darwin':
                candidates.append(os.path.realpath(os.path.join(os.path.dirname(sys.executable), '..', 'Frameworks', 'analytics_config.json')))
        except Exception:
            pass
        try:
            candidates.append(os.path.join(os.path.dirname(__file__), 'analytics_config.json'))
        except Exception:
            pass
        try:
            candidates.append(os.path.join(os.getcwd(), 'analytics_config.json'))
        except Exception:
            pass
        for p in candidates:
            try:
                if not p or not os.path.exists(p):
                    continue
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f) or {}
                if isinstance(data, dict):
                    self._config_path = p
                    return data
            except Exception:
                continue
        return {}

    def _start_worker(self):
        if self._started:
            return
        with self._lock:
            if self._started:
                return
            t = threading.Thread(target=self._run, daemon=True)
            t.start()
            self._started = True

    def _run(self):
        while True:
            try:
                event = self._q.get()
            except Exception:
                continue
            try:
                self._post(event)
            except Exception:
                pass
            try:
                self._q.task_done()
            except Exception:
                pass

    def _post(self, event: dict):
        api = f"{self._url_base}/functions/v1/quicksend-analytics-ingest"
        self._last_request_method = 'POST'
        self._last_request_url = api
        data = json.dumps(event, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(api, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Accept', 'application/json')
        req.add_header('apikey', self._anon_key)
        req.add_header('Authorization', f"Bearer {self._anon_key}")
        self._last_request_has_apikey = bool(self._anon_key)
        self._last_request_has_authorization = bool(self._anon_key)
        try:
            if self._ssl_context is not None:
                resp = urllib.request.urlopen(req, timeout=5, context=self._ssl_context)
            else:
                resp = urllib.request.urlopen(req, timeout=5)
            try:
                self._last_response_code = getattr(resp, 'status', None) or getattr(resp, 'getcode', lambda: None)()
            except Exception:
                self._last_response_code = None
            try:
                self._last_response_body = resp.read(2000).decode('utf-8', errors='replace')
            except Exception:
                self._last_response_body = ''
            self._last_error = ''
            if (not self._success_logged) and self._logger:
                self._success_logged = True
                try:
                    self._logger(f"[Analytics] post ok: code={self._last_response_code}, body={self._last_response_body[:200]}")
                except Exception:
                    pass
        except Exception as e:
            try:
                import urllib.error as urllib_error
                if isinstance(e, urllib_error.HTTPError):
                    body = ''
                    try:
                        body = e.read(2000).decode('utf-8', errors='replace')
                    except Exception:
                        body = ''
                    try:
                        self._last_response_code = getattr(e, 'code', None)
                        self._last_response_body = body
                    except Exception:
                        pass
                    self._last_error = f'http_{e.code}: {body}'.strip()
                else:
                    self._last_response_code = None
                    self._last_response_body = ''
                    self._last_error = str(e)
            except Exception:
                self._last_response_code = None
                self._last_response_body = ''
                self._last_error = str(e)
            try:
                if self._logger:
                    self._logger(f'[Analytics] post failed: {self._last_error or str(e)}')
            except Exception:
                pass

    def post_now(self, event: dict) -> dict:
        try:
            self._post(event)
            return {
                'ok': (self._last_error == ''),
                'status': self.status(),
            }
        except Exception as e:
            self._last_error = str(e)
            return {
                'ok': False,
                'status': self.status(),
            }

analytics = SupabaseAnalytics()

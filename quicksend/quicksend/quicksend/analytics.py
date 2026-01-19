import json
import os
import queue
import threading
import urllib.request


class SupabaseAnalytics:
    def __init__(self):
        self._enabled = str(os.environ.get('SUPABASE_ANALYTICS_ENABLED', '1')).lower() in ('1', 'true', 'yes', 'on')
        self._url_base = (os.environ.get('SUPABASE_URL') or '').rstrip('/')
        self._anon_key = os.environ.get('SUPABASE_ANON_KEY') or ''
        self._schema = os.environ.get('SUPABASE_ANALYTICS_SCHEMA') or 'quicksend_analytics'
        self._table = os.environ.get('SUPABASE_ANALYTICS_TABLE') or 'events_raw_v1'
        self._q = queue.Queue(maxsize=200)
        self._started = False
        self._lock = threading.Lock()

    def enabled(self) -> bool:
        return bool(self._enabled and self._url_base and self._anon_key)

    def track(self, event: dict):
        if not self.enabled():
            return
        try:
            self._start_worker()
            self._q.put_nowait(event)
        except Exception:
            pass

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
        data = json.dumps(event, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(api, data=data, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Accept', 'application/json')
        req.add_header('apikey', self._anon_key)
        req.add_header('Authorization', f"Bearer {self._anon_key}")
        urllib.request.urlopen(req, timeout=2)


analytics = SupabaseAnalytics()

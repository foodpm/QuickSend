import sys


def main() -> int:
    sys.path.insert(0, "quicksend/quicksend/quicksend")
    import app as m  # noqa: F401

    c = m.app.test_client()

    urls = [
        "/",
        "/dist",
        "/dist/",
        "/dist/index.html",
        "/api/diag",
        "/api/version",
    ]
    for u in urls:
        r = c.get(u, headers={"Accept": "text/html"})
        loc = (r.headers.get("Location") or "")[:120]
        print(u, r.status_code, loc)

    r = c.get("/api/not-exist")
    print("/api/not-exist", r.status_code, r.is_json, r.get_json())
    if not (r.is_json and isinstance(r.get_json() or {}, dict) and (r.get_json() or {}).get("diag_code")):
        raise SystemExit("missing diag_code for api 404")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


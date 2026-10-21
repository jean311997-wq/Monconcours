import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8776", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True); ctx = nav.new_context(viewport={"width":390,"height":844}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'T', tel:'70000000', niveau:'terminale'}));")
        page = ctx.new_page(); page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.route("**/fonts.*/**", lambda r: r.abort()); page.route("**/*.supabase.co/**", lambda r: r.abort())
        page.goto("http://127.0.0.1:8776/index.html"); page.wait_for_function("typeof S !== 'undefined' && base !== null", timeout=15000); page.wait_for_timeout(1000)
        # 1. le bandeau cache-t-il l'en-tête, et combien de temps ?
        t0 = time.time(); vu = None
        for i in range(40):
            b = page.evaluate("(() => { const b = document.querySelector('.bandeau-notif'); if(!b) return null; const r = b.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), vis: getComputedStyle(b).display !== 'none' && getComputedStyle(b).opacity !== '0' }; })()")
            if i in (0, 5, 10, 20, 39): print("t=%.1fs bandeau=%s" % (time.time() - t0, b))
            page.wait_for_timeout(500)
        # 2. « Reprendre » du cahier d'erreurs
        page.evaluate("aller('cahier')"); page.wait_for_timeout(1200)
        n = page.evaluate("document.querySelectorAll('button.reprendre').length")
        ecran_avant = page.evaluate("S.ecran")
        if n:
            page.evaluate("document.querySelector('button.reprendre').click()"); page.wait_for_timeout(800)
        print("cahier : boutons Reprendre =", n, "| écran avant/après =", ecran_avant, "->", page.evaluate("S.ecran"))
        nav.close()
finally: srv.terminate()

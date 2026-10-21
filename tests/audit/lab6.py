import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8777", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True); ctx = nav.new_context(viewport={"width":390,"height":844}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'T', tel:'70000000', niveau:'terminale'}));")
        page = ctx.new_page(); errs=[]; page.on("pageerror", lambda e: errs.append(str(e)[:120]))
        page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.route("**/fonts.*/**", lambda r: r.abort()); page.route("**/*.supabase.co/**", lambda r: r.abort())
        page.goto("http://127.0.0.1:8777/index.html"); page.wait_for_function("typeof S !== 'undefined' && base !== null", timeout=15000); page.wait_for_timeout(1000)
        page.evaluate("aller('cahier')"); page.wait_for_timeout(1200)
        for k in range(3):
            av = page.evaluate("[S.ecran, vue().innerHTML.length, JSON.stringify(Object.keys(S).filter(k => /repri|ouvert/i.test(k)).map(k => [k, S[k]]))]")
            page.evaluate("(k) => document.querySelectorAll('button.reprendre, button.valider')[k] && document.querySelectorAll('button.reprendre, button.valider')[k].click()", k)
            page.wait_for_timeout(700)
            ap = page.evaluate("[S.ecran, vue().innerHTML.length, JSON.stringify(Object.keys(S).filter(k => /repri|ouvert/i.test(k)).map(k => [k, S[k]]))]")
            print("bouton", k, "avant", av[:2], "après", ap[:2], "| état:", ap[2][:120])
        print("erreurs JS :", errs)
        nav.close()
finally: srv.terminate()

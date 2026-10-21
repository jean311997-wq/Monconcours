"""Banc 3 : connexion lente + processeur lent + hors ligne — copie locale servie en gzip. Les appels à la base sont coupés (non mesurés)."""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8774", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
PROFILS = {
  "3G rapide (1,6 Mb/s, 560 ms)": dict(lat=562, down=1.6e6/8, up=750e3/8),
  "3G lente (400 kb/s, 2 s)": dict(lat=2000, down=400e3/8, up=400e3/8),
  "2G (150 kb/s, 400 ms)": dict(lat=400, down=150e3/8, up=60e3/8),
}
INIT = """
window.__t = {};
new PerformanceObserver(l => { for(const e of l.getEntries()){ if(e.name === 'first-contentful-paint') window.__t.fcp = e.startTime; } }).observe({ type: 'paint', buffered: true });
new PerformanceObserver(l => { const e = l.getEntries().pop(); window.__t.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
window.__t.tbt = 0; try{ new PerformanceObserver(l => { for(const e of l.getEntries()){ if(e.duration > 50) window.__t.tbt += e.duration - 50; } }).observe({ type: 'longtask', buffered: true }); }catch(e){}
const surveiller = () => { const v = document.getElementById('vue'); if(v && v.innerHTML.length > 80){ window.__t.rendu = performance.now(); return; } requestAnimationFrame(surveiller); };
document.addEventListener('DOMContentLoaded', surveiller);
"""
res = {}
def cdp(ctx, page, prof, cpu=4):
    c = ctx.new_cdp_session(page)
    c.send("Network.enable")
    if prof: c.send("Network.emulateNetworkConditions", dict(offline=False, latency=prof["lat"], downloadThroughput=prof["down"], uploadThroughput=prof["up"]))
    c.send("Emulation.setCPUThrottlingRate", dict(rate=cpu))
    return c
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        for nom, prof in PROFILS.items():
            ctx = nav.new_context(viewport={"width": 360, "height": 740}, service_workers="block")
            ctx.add_init_script(INIT)
            page = ctx.new_page()
            page.route("**/*.supabase.co/**", lambda r: r.abort())
            page.route("**/fonts.*/**", lambda r: r.abort())
            octets = [0]
            page.on("response", lambda rep: octets.__setitem__(0, octets[0] + int((rep.headers.get("content-length") or 0))))
            cdp(ctx, page, prof)
            t0 = time.time()
            page.goto("http://127.0.0.1:8774/index.html", wait_until="commit")
            try:
                page.wait_for_function("window.__t && window.__t.rendu", timeout=120000)
            except Exception as e:
                res[nom] = {"erreur": "pas d'affichage en 120 s"}; ctx.close(); continue
            page.wait_for_timeout(1500)
            t = page.evaluate("window.__t")
            res[nom] = {"fcp_ms": round(t.get("fcp") or 0), "lcp_ms": round(t.get("lcp") or 0), "rendu_app_ms": round(t["rendu"]), "blocage_total_ms": round(t.get("tbt") or 0), "octets_recus": octets[0]}
            print(nom, res[nom], flush=True)
            ctx.close()
        # visite suivante + hors ligne, avec le service worker
        ctx = nav.new_context(viewport={"width": 360, "height": 740})
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        page.route("**/*.supabase.co/**", lambda r: r.abort()); page.route("**/fonts.*/**", lambda r: r.abort())
        page.goto("http://127.0.0.1:8774/index.html"); page.wait_for_timeout(6000)
        sw = page.evaluate("navigator.serviceWorker.controller ? 'actif' : 'pas encore'")
        regs = page.evaluate("navigator.serviceWorker.getRegistrations().then(r => r.length)")
        ctx.set_offline(True)
        page.reload(); page.wait_for_timeout(3000)
        v = page.evaluate("(document.getElementById('vue') || {innerText:''}).innerText.length")
        facade = page.evaluate("(document.getElementById('facade') || {className:''}).className")
        res["hors_ligne"] = {"service_worker": sw, "enregistrements": regs, "ecran_apres_rechargement_hors_ligne_(car.)": v, "facade": facade}
        print("hors ligne", res["hors_ligne"], flush=True)
        ctx.set_offline(False); ctx.close(); nav.close()
finally:
    srv.terminate()
json.dump(res, open(os.path.join(ICI, "lab3.json"), "w"), ensure_ascii=False, indent=1)

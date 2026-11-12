/* Mode clair / mode sombre de l'administration. Le choix reste sur l'appareil. */
(function(){
  var CLE = 'mc-admin-theme', racine = document.documentElement;
  function lire(){ try{ return localStorage.getItem(CLE) === 'clair' ? 'clair' : 'sombre'; }catch(e){ return 'sombre'; } }
  function appliquer(t){
    racine.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if(m) m.setAttribute('content', t === 'clair' ? '#F3F6F4' : '#0C1512');
    var b = document.getElementById('btn-theme');
    if(b){
      b.textContent = t === 'clair' ? '☾ Mode sombre' : '☀ Mode clair';
      b.setAttribute('aria-label', t === 'clair' ? 'Passer en mode sombre' : 'Passer en mode clair');
    }
  }
  appliquer(lire());
  document.addEventListener('DOMContentLoaded', function(){
    var zone = document.querySelector('.tete .droite');
    if(zone && !document.getElementById('btn-theme')){
      var b = document.createElement('button');
      b.className = 'lien'; b.id = 'btn-theme'; b.type = 'button';
      zone.insertBefore(b, zone.firstChild);
      b.addEventListener('click', function(){
        var t = racine.getAttribute('data-theme') === 'clair' ? 'sombre' : 'clair';
        try{ localStorage.setItem(CLE, t); }catch(e){}
        appliquer(t);
      });
    }
    appliquer(lire());
  });
})();

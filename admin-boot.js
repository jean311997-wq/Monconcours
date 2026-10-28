/* Chargement de l'administration : la bibliothèque Supabase (servie par le
   site, version 2.112.2), puis admin.js une fois qu'elle est arrivée.
   Pas de secours sur un CDN extérieur : l'espace admin ne charge que des
   fichiers du site. */
(function(){
  function demarrerAdmin(){
    /* les compléments d'abord (ils s'enregistrent), puis admin.js */
    var liste = ['admin-plus.js?v=2', 'admin-plus2.js?v=1', 'admin.js?v=24'], i = 0;
    (function suite(){
      if(i >= liste.length) return;
      var s = document.createElement('script');
      s.src = liste[i++];
      s.onload = s.onerror = suite;
      document.body.appendChild(s);
    })();
  }
  var t = document.createElement('script');
  t.src = '/supabase-js.min.js?v=13';
  t.onload = demarrerAdmin;
  t.onerror = demarrerAdmin;          // admin.js affichera la panne lui-même
  document.head.appendChild(t);
})();

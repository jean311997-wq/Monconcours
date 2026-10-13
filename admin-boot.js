/* Chargement de l'administration : la bibliothèque Supabase (servie par le
   site, version 2.112.2), puis admin.js une fois qu'elle est arrivée.
   Pas de secours sur un CDN extérieur : l'espace admin ne charge que des
   fichiers du site. */
(function(){
  function demarrerAdmin(){
    var s = document.createElement('script');
    s.src = 'admin.js?v=14';
    document.body.appendChild(s);
  }
  var t = document.createElement('script');
  t.src = '/supabase-js.min.js?v=13';
  t.onload = demarrerAdmin;
  t.onerror = demarrerAdmin;          // admin.js affichera la panne lui-même
  document.head.appendChild(t);
})();

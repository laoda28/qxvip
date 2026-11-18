var h = $request.headers || {};
var kill = ['If-None-Match','if-none-match','If-Modified-Since','if-modified-since'];
for (var i = 0; i < kill.length; i++) { try { delete h[kill[i]]; } catch (e) {} }
h['Cache-Control'] = 'no-cache';
h['Pragma'] = 'no-cache';
console.log('[TT-REQ] ' + $request.url);
$done({ headers: h });

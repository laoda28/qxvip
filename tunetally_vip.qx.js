// TuneTally VIP unlock  --  v3 (单文件：同时处理 request-header 与 response-body)
var STORE = 'tt_v3';
var FALLBACK_IDS = ['pro','premium','plus','vip','lifetime','unlock','access','all_access','full','full_access',
  'premium_access','pro_access','vip_access','subscriber','subscription','standard','member','membership',
  'tunetally','tunetally_pro','tunetally_premium','TuneTally Pro','TuneTally Premium','tt_pro','tt_premium',
  'paid','upgrade','unlocked','gold','elite','no_ads','remove_ads','ad_free','premium_member','vip_member'];

function load(){ try{ var s=$persistentStore.read(STORE); if(s) return JSON.parse(s); }catch(e){} return { ids:[], products:[] }; }
function save(o){ try{ $persistentStore.write(JSON.stringify(o), STORE); }catch(e){} }
function uniq(a){ var r=[],s={}; for(var i=0;i<a.length;i++){ if(a[i] && !s[a[i]]){ s[a[i]]=1; r.push(a[i]); } } return r; }

var url  = $request.url;
var path = url.replace(/^https?:\/\/[^\/]+/,'');

// ============ 请求阶段：干掉 RevenueCat 的 ETag，逼它返回全量 ============
if (typeof $response === 'undefined') {
  var h = $request.headers || {};
  var kill = ['X-RevenueCat-ETag','x-revenuecat-etag','If-None-Match','if-none-match','If-Modified-Since','if-modified-since'];
  for (var i = 0; i < kill.length; i++) { try { delete h[kill[i]]; } catch (e) {} }
  h['Cache-Control'] = 'no-cache';
  h['Pragma'] = 'no-cache';
  console.log('[TT3-REQ] ' + url);
  $done({ headers: h });
} else {
  // ============ 响应阶段 ============
  console.log('[TT3] ' + $request.method + ' ' + url);
  var body = ($response && $response.body) || '';
  var hdrs = ($response && $response.headers) || {};
  var st = load();
  var changed = false;

  if (path.indexOf('product_entitlement_mapping') >= 0) {
    console.log('[TT3-MAP-RAW] len=' + body.length + ' head=' + body.slice(0, 1000));
    try {
      var m = JSON.parse(body), map = m.product_entitlement_mapping || {};
      for (var k in map) {
        st.products.push(k);
        var ents = (map[k] || {}).entitlements || [];
        for (var e1 = 0; e1 < ents.length; e1++) st.ids.push(ents[e1]);
      }
      st.ids = uniq(st.ids); st.products = uniq(st.products); save(st);
      console.log('[TT3-MAP] ids=' + st.ids.join('|') + ' products=' + st.products.join('|'));
    } catch (err) { console.log('[TT3-MAP-ERR] ' + err); }
  }

  if (path.indexOf('/offerings') >= 0) {
    console.log('[TT3-OFF-RAW] len=' + body.length + ' head=' + body.slice(0, 1500));
    try {
      var o = JSON.parse(body), all = o.offerings || {};
      for (var ok in all) {
        var pk = (all[ok] || {}).packages || [];
        for (var p = 0; p < pk.length; p++) {
          var pr = (pk[p] || {}).product || {};
          if (pr.identifier) st.products.push(pr.identifier);
          console.log('[TT3-OFF-PKG] ' + pk[p].identifier + ' -> ' + pr.identifier + ' (' + (pr.subscription_period || '') + ')');
        }
      }
      st.products = uniq(st.products); save(st);
      console.log('[TT3-OFF] products=' + st.products.join('|'));
    } catch (err) { console.log('[TT3-OFF-ERR] ' + err); }
  }

  if (path.indexOf('/v1/subscribers/') >= 0 || path.indexOf('/v1/receipts') >= 0) {
    try {
      var j = JSON.parse(body);
      if (j && j.subscriber) {
        var sub = j.subscriber;
        console.log('[TT3-PRE] ents=' + JSON.stringify(sub.entitlements || {}).slice(0, 300) +
                    ' subs=' + JSON.stringify(Object.keys(sub.subscriptions || {})));
        var ids = uniq(st.ids.concat(FALLBACK_IDS));
        var prods = st.products.slice(0);
        if (!prods.length) prods = ['com.universeye.TuneTally.premium'];
        var prodId = prods[0];
        if (!sub.entitlements) sub.entitlements = {};
        for (var a = 0; a < ids.length; a++) {
          sub.entitlements[ids[a]] = {
            expires_date: null, grace_period_expires_date: null,
            purchase_date: '2020-01-01T00:00:00Z',
            product_identifier: prodId, store: 'app_store'
          };
        }
        if (!sub.subscriptions) sub.subscriptions = {};
        for (var b = 0; b < prods.length; b++) {
          sub.subscriptions[prods[b]] = {
            billing_issues_detected_at: null, expires_date: '2099-12-31T23:59:59Z',
            grace_period_expires_date: null, is_sandbox: false,
            original_purchase_date: '2020-01-01T00:00:00Z', period_type: 'normal',
            purchase_date: '2020-01-01T00:00:00Z', refunded_at: null,
            store: 'app_store', unsubscribe_detected_at: null
          };
        }
        if (!sub.non_subscriptions) sub.non_subscriptions = {};
        if (!sub.first_seen) sub.first_seen = '2020-01-01T00:00:00Z';
        if (!sub.original_purchase_date) sub.original_purchase_date = '2020-01-01T00:00:00Z';
        body = JSON.stringify(j); changed = true;
        console.log('[TT3-HIT] ents=' + ids.length + ' subs=' + prods.length + ' learned_ids=' + st.ids.length + ' learned_prods=' + st.products.length);
      } else {
        console.log('[TT3-NOSUB] keys=' + Object.keys(j || {}).join('|'));
      }
    } catch (err) { console.log('[TT3-ERR] ' + path + ' ' + err + ' len=' + body.length); }
  }

  try { delete hdrs['x-revenuecat-etag']; delete hdrs['X-RevenueCat-ETag']; } catch (e2) {}
  if (changed) { $done({ body: body, headers: hdrs }); } else { $done({ headers: hdrs }); }
}

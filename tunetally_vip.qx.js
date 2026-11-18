// TuneTally VIP unlock -- v5  (strip x-signature + non_subscriptions[tunetally_pro])
var STORE = 'tt_v5';
var PROD = 'tunetally_pro';
var FALLBACK_IDS = ['pro','premium','plus','vip','lifetime','unlock','access','all_access','full','full_access',
  'premium_access','pro_access','vip_access','subscriber','subscription','standard','member','membership',
  'tunetally','tunetally_pro','tunetally_premium','TuneTally Pro','TuneTally Premium','tt_pro','tt_premium',
  'paid','upgrade','unlocked','gold','elite','no_ads','remove_ads','ad_free','premium_member','vip_member',
  'pro_entitlement','premium_entitlement','lifetime_access','tunetally_lifetime','removeAds','noAds','ads_free'];

function load(){ try{ var s=$persistentStore.read(STORE); if(s) return JSON.parse(s); }catch(e){} return { ids:[], products:[] }; }
function save(o){ try{ $persistentStore.write(JSON.stringify(o), STORE); }catch(e){} }
function uniq(a){ var r=[],s={}; for(var i=0;i<a.length;i++){ if(a[i] && !s[a[i]]){ s[a[i]]=1; r.push(a[i]); } } return r; }

var url  = $request.url;
var path = url.replace(/^https?:\/\/[^\/]+/,'');

if (typeof $response === 'undefined') {
  var h = $request.headers || {};
  var kill = ['X-RevenueCat-ETag','x-revenuecat-etag','If-None-Match','if-none-match','If-Modified-Since','if-modified-since'];
  for (var i = 0; i < kill.length; i++) { try { delete h[kill[i]]; } catch (e) {} }
  h['Cache-Control'] = 'no-cache';
  h['Pragma'] = 'no-cache';
  console.log('[TT5-REQ] ' + url);
  $done({ headers: h });
} else {
  var body = ($response && $response.body) || '';
  var hdrs = ($response && $response.headers) || {};
  var st = load();
  var changed = false;

  var hk = []; for (var hh in hdrs) hk.push(hh);
  console.log('[TT5] ' + $request.method + ' ' + path + ' len=' + body.length + ' hdr=' + hk.join(','));

  // 关键：删掉 RevenueCat 的签名头，避免 SDK 校验失败
  var drop = ['x-signature','X-Signature','x-revenuecat-etag','X-RevenueCat-ETag'];
  for (var d = 0; d < drop.length; d++) { try { delete hdrs[drop[d]]; } catch (e0) {} }

  if (path.indexOf('product_entitlement_mapping') >= 0) {
    console.log('[TT5-MAP-RAW] ' + body.slice(0, 600));
    try {
      var m = JSON.parse(body), map = m.product_entitlement_mapping || {};
      for (var k in map) {
        st.products.push(k);
        var ents = (map[k] || {}).entitlements || [];
        for (var e1 = 0; e1 < ents.length; e1++) st.ids.push(ents[e1]);
      }
      st.ids = uniq(st.ids); st.products = uniq(st.products); save(st);
      console.log('[TT5-MAP] ids=' + st.ids.join('|'));
    } catch (err) { console.log('[TT5-MAP-ERR] ' + err); }
  }

  if (path.indexOf('/offerings') >= 0) {
    try {
      var o = JSON.parse(body), all = o.offerings || {};
      for (var ok in all) {
        var pk = (all[ok] || {}).packages || [];
        for (var p = 0; p < pk.length; p++) {
          var pp = pk[p] || {};
          var pid = pp.platform_product_identifier || '';
          if (pid) st.products.push(pid);
        }
      }
      st.products = uniq(st.products); save(st);
      console.log('[TT5-OFF] products=' + st.products.join('|'));
    } catch (err) { console.log('[TT5-OFF-ERR] ' + err); }
  }

  if (path.indexOf('/v1/subscribers/') >= 0 || path.indexOf('/v1/receipts') >= 0) {
    try {
      var j = JSON.parse(body);
      if (j && j.subscriber) {
        var sub = j.subscriber;
        var ids = uniq(st.ids.concat(FALLBACK_IDS));
        var prods = uniq(st.products.concat([PROD]));

        if (!sub.non_subscriptions) sub.non_subscriptions = {};
        for (var q = 0; q < prods.length; q++) {
          sub.non_subscriptions[prods[q]] = [{
            id: prods[q], is_sandbox: false,
            purchase_date: '2020-01-01T00:00:00Z',
            store: 'app_store',
            store_transaction_id: '2000000000000001'
          }];
        }

        if (!sub.entitlements) sub.entitlements = {};
        for (var a = 0; a < ids.length; a++) {
          sub.entitlements[ids[a]] = {
            expires_date: null, grace_period_expires_date: null,
            purchase_date: '2020-01-01T00:00:00Z',
            product_identifier: PROD, store: 'app_store'
          };
        }

        if (!sub.subscriptions) sub.subscriptions = {};
        if (!sub.subscriptions[PROD]) {
          sub.subscriptions[PROD] = {
            billing_issues_detected_at: null, expires_date: '2099-12-31T23:59:59Z',
            grace_period_expires_date: null, is_sandbox: false,
            original_purchase_date: '2020-01-01T00:00:00Z', period_type: 'normal',
            purchase_date: '2020-01-01T00:00:00Z', refunded_at: null,
            store: 'app_store', unsubscribe_detected_at: null
          };
        }

        if (!sub.first_seen) sub.first_seen = '2020-01-01T00:00:00Z';
        if (!sub.original_purchase_date) sub.original_purchase_date = '2020-01-01T00:00:00Z';
        if (!sub.management_url) sub.management_url = 'https://apps.apple.com/account/subscriptions';

        body = JSON.stringify(j); changed = true;
        console.log('[TT5-HIT] ents=' + ids.length + ' nsub=' + prods.length + ' bodyLen=' + body.length);
      } else {
        console.log('[TT5-NOSUB] keys=' + Object.keys(j || {}).join('|'));
      }
    } catch (err) { console.log('[TT5-ERR] ' + path + ' ' + err + ' len=' + body.length); }
  }

  if (changed) { $done({ body: body, headers: hdrs }); } else { $done({ headers: hdrs }); }
}

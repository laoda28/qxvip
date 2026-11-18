// TuneTally VIP unlock -- v4 (tunetally_pro = 一次性内购 -> non_subscriptions)
var STORE = 'tt_v4';
var PROD = 'tunetally_pro';
var FALLBACK_IDS = ['pro','premium','plus','vip','lifetime','unlock','access','all_access','full','full_access',
  'premium_access','pro_access','vip_access','subscriber','subscription','standard','member','membership',
  'tunetally','tunetally_pro','tunetally_premium','TuneTally Pro','TuneTally Premium','tt_pro','tt_premium',
  'paid','upgrade','unlocked','gold','elite','no_ads','remove_ads','ad_free','premium_member','vip_member'];

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
  console.log('[TT4-REQ] ' + url);
  $done({ headers: h });
} else {
  console.log('[TT4] ' + $request.method + ' ' + url);
  var body = ($response && $response.body) || '';
  var hdrs = ($response && $response.headers) || {};
  var st = load();
  var changed = false;

  if (path.indexOf('product_entitlement_mapping') >= 0) {
    console.log('[TT4-MAP-RAW] len=' + body.length + ' head=' + body.slice(0, 800));
    try {
      var m = JSON.parse(body), map = m.product_entitlement_mapping || {};
      for (var k in map) {
        st.products.push(k);
        var ents = (map[k] || {}).entitlements || [];
        for (var e1 = 0; e1 < ents.length; e1++) st.ids.push(ents[e1]);
      }
      st.ids = uniq(st.ids); st.products = uniq(st.products); save(st);
      console.log('[TT4-MAP] ids=' + st.ids.join('|') + ' products=' + st.products.join('|'));
    } catch (err) { console.log('[TT4-MAP-ERR] ' + err); }
  }

  if (path.indexOf('/offerings') >= 0) {
    try {
      var o = JSON.parse(body), all = o.offerings || {};
      for (var ok in all) {
        var pk = (all[ok] || {}).packages || [];
        for (var p = 0; p < pk.length; p++) {
          var pp = pk[p] || {};
          var pid = pp.platform_product_identifier || (pp.product && pp.product.identifier) || '';
          if (pid) st.products.push(pid);
          console.log('[TT4-OFF-PKG] ' + pp.identifier + ' -> ' + pid);
        }
      }
      st.products = uniq(st.products); save(st);
      console.log('[TT4-OFF] products=' + st.products.join('|'));
    } catch (err) { console.log('[TT4-OFF-ERR] ' + err); }
  }

  if (path.indexOf('/v1/subscribers/') >= 0 || path.indexOf('/v1/receipts') >= 0) {
    try {
      var j = JSON.parse(body);
      if (j && j.subscriber) {
        var sub = j.subscriber;
        console.log('[TT4-PRE] ents=' + JSON.stringify(sub.entitlements || {}).slice(0, 200) +
                    ' subs=' + JSON.stringify(Object.keys(sub.subscriptions || {})) +
                    ' nsub=' + JSON.stringify(Object.keys(sub.non_subscriptions || {})));

        var ids = uniq(st.ids.concat(FALLBACK_IDS));
        var prod = PROD;

        if (!sub.non_subscriptions) sub.non_subscriptions = {};
        sub.non_subscriptions[prod] = [{
          id: prod, is_sandbox: false,
          purchase_date: '2020-01-01T00:00:00Z',
          store: 'app_store',
          store_transaction_id: '2000000000000001'
        }];

        if (!sub.entitlements) sub.entitlements = {};
        for (var a = 0; a < ids.length; a++) {
          sub.entitlements[ids[a]] = {
            expires_date: null, grace_period_expires_date: null,
            purchase_date: '2020-01-01T00:00:00Z',
            product_identifier: prod, store: 'app_store'
          };
        }

        if (!sub.subscriptions) sub.subscriptions = {};
        if (!sub.subscriptions[prod]) {
          sub.subscriptions[prod] = {
            billing_issues_detected_at: null, expires_date: '2099-12-31T23:59:59Z',
            grace_period_expires_date: null, is_sandbox: false,
            original_purchase_date: '2020-01-01T00:00:00Z', period_type: 'normal',
            purchase_date: '2020-01-01T00:00:00Z', refunded_at: null,
            store: 'app_store', unsubscribe_detected_at: null
          };
        }

        if (!sub.first_seen) sub.first_seen = '2020-01-01T00:00:00Z';
        if (!sub.original_purchase_date) sub.original_purchase_date = '2020-01-01T00:00:00Z';
        body = JSON.stringify(j); changed = true;
        console.log('[TT4-HIT] ents=' + ids.length + ' prod=' + prod + ' learned_ids=' + st.ids.length);
      } else {
        console.log('[TT4-NOSUB] keys=' + Object.keys(j || {}).join('|'));
      }
    } catch (err) { console.log('[TT4-ERR] ' + path + ' ' + err + ' len=' + body.length); }
  }

  try { delete hdrs['x-revenuecat-etag']; delete hdrs['X-RevenueCat-ETag']; } catch (e2) {}
  if (changed) { $done({ body: body, headers: hdrs }); } else { $done({ headers: hdrs }); }
}

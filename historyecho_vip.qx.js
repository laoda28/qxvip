/**
 * 历史年轮 VIP 改写 v2 —— Quantumult X
 */
const TRUE_KEYS = /^(is_vip|isVip|isVIP|vip|is_member|isMember|is_premium|isPremium|premium|is_pro|isPro|subscribed|is_subscribed|isSubscribed|vip_status|is_vip_user|member_status)$/;
const NEED_KEYS = /^(need_vip|needVip|need_pay|pay_required|require_vip|requireVip|is_locked|locked|vip_required)$/;
const END_KEYS  = /^(vip_end_time|vipEndTime|memberVipEndTime|member_vip_end_time|vip_expire|vipExpire|vip_expire_time|expire_time|expires_at|expired_at|vip_end|vipEnd|member_expire|member_expire_time)$/;

function fixEnd(v) {
  if (typeof v === 'string') return /^\d+$/.test(v) ? (v.length >= 13 ? '4102444800000' : '4102444800') : '4102444800';
  if (typeof v === 'number') return v > 1e12 ? 4102444800000 : 4102444800;
  return 4102444800;
}

let hits = [];
function walk(o, path) {
  if (Array.isArray(o)) { o.forEach((x, i) => walk(x, path + '[' + i + ']')); return; }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k], p = path ? path + '.' + k : k;
    if (TRUE_KEYS.test(k) && typeof v === 'boolean') { hits.push(p + ':' + v + '->true'); o[k] = true; continue; }
    if (NEED_KEYS.test(k) && typeof v === 'boolean') { hits.push(p + ':' + v + '->false'); o[k] = false; continue; }
    if (END_KEYS.test(k) && (typeof v === 'number' || typeof v === 'string' || v === null)) { hits.push(p + ':' + v + '->end'); o[k] = fixEnd(v); continue; }
    walk(v, p);
  }
}

let body = $response.body || '';
try {
  const j = JSON.parse(body);
  walk(j, '');
  if (hits.length) {
    console.log('[YEARS-HIT] ' + $request.url + '  ' + hits.join(' | '));
    body = JSON.stringify(j);
  } else if (/vip|permission|member|pricing|subscri/i.test(body)) {
    console.log('[YEARS-RAW] ' + $request.url + '  ' + body.substring(0, 1200));
  }
} catch (e) {
  console.log('[YEARS-NONJSON] ' + $request.url + '  ' + body.substring(0, 400));
}
$done({ body });

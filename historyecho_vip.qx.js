console.log('[Y-ALIVE] v9 ' + $request.method + ' ' + $request.url);

const TRUE_KEYS = /^(is_vip|isVip|isVIP|vip|is_member|isMember|is_premium|isPremium|premium|is_pro|isPro|subscribed|is_subscribed|isSubscribed|vip_status|is_vip_user|is_permanent|isPermanent|has_vip)$/;
const CAN_KEYS  = /^can_(?!admin)/;
const NEED_KEYS = /^(need_vip|needVip|need_pay|pay_required|require_vip|requireVip|is_locked|locked|vip_required)$/;
const END_KEYS  = /^(vip_end_time|vipEndTime|memberVipEndTime|member_vip_end_time|vip_expire|vipExpire|vip_expire_time|expire_time|expires_at|expired_at|vip_end|vipEnd|member_expire|member_expire_time|vip_expire_at|vip_end_date)$/;
const DAY_KEYS  = /^(have_days|haveDays|remain_days|remainDays|vip_days)$/;

const DATE_STR = '2099-12-31 23:59:59';

function fixEnd(v) {
  if (typeof v === 'number') return v > 1e12 ? 4102444800000 : 4102444800;
  if (typeof v === 'string') {
    if (/^\d{13,}$/.test(v)) return '4102444800000';
    if (/^\d{9,12}$/.test(v)) return '4102444800';
    return DATE_STR;
  }
  return DATE_STR;
}

let hits = [];
function walk(o, path) {
  if (Array.isArray(o)) { o.forEach(function (x, i) { walk(x, path + '[' + i + ']'); }); return; }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k], p = path ? path + '.' + k : k;
    if (TRUE_KEYS.test(k) && typeof v === 'boolean') { hits.push(p); o[k] = true; continue; }
    if (CAN_KEYS.test(k) && typeof v === 'boolean') { hits.push(p); o[k] = true; continue; }
    if (NEED_KEYS.test(k) && typeof v === 'boolean') { hits.push(p); o[k] = false; continue; }
    if (END_KEYS.test(k) && (typeof v === 'number' || typeof v === 'string' || v === null)) { hits.push(p); o[k] = fixEnd(v); continue; }
    if (DAY_KEYS.test(k) && typeof v === 'number') { hits.push(p); o[k] = 3650; continue; }
    if (k === 'member_level' && typeof v === 'string' && /^(none|)$/i.test(v)) { hits.push(p); o[k] = 'year'; continue; }
    if (k === 'role_id' && typeof v === 'number' && v < 4) { hits.push(p); o[k] = 4; continue; }
    if ((k === 'role_name' || /\.role\.name$/.test(p)) && v === '普通用户') { hits.push(p); o[k] = '高级会员'; continue; }
    walk(v, p);
  }
}

const url = $request.url;
let body = ($response && $response.body) || '';
const short = url.replace(/^https?:\/\/[^\/]+/, '');

try {
  const j = JSON.parse(body);
  const arr = j && j.data && j.data.figure_lists;
  if (Array.isArray(arr)) {
    arr.forEach(function (g, i) {
      if (!g) return;
      const gk = Object.keys(g).join(',');
      const first = Array.isArray(g.list) && g.list[0] ? g.list[0] : null;
      const ik = first ? Object.keys(first).join(',') : '';
      const ek = first && first.entity ? Object.keys(first.entity).join(',') : '';
      console.log('[Y-K] i=' + i + ' name=' + g.name + ' need_vip=' + g.need_vip + ' len=' + (g.list ? g.list.length : -1));
      console.log('[Y-KK] i=' + i + ' G={' + gk + '}');
      if (ik) console.log('[Y-KK] i=' + i + ' I={' + ik + '} E={' + ek + '}');
      if (first && i >= 2 && i <= 4) {
        console.log('[Y-I] i=' + i + ' ' + JSON.stringify(first).substring(0, 700));
      }
    });
  }
  walk(j, '');
  if (hits.length) {
    console.log('[Y-HIT] ' + short + '  ' + hits.length + ' changes');
    body = JSON.stringify(j);
  }
} catch (e) {
  console.log('[Y-ERR] ' + short + ' ' + e + ' len=' + body.length);
}
$done({ body });

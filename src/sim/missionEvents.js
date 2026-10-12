// 任務事件：字卡內容、HUD 階段文字、時間軸里程碑、大氣分層
import { EV, LIFTOFF_MASS, TWR } from './flightData.js';
import { fmtNum } from '../utils/format.js';

export const CARDS = [
  { id: 'ign', t0: -3.4, t1: 2.5, code: 'IGNITION', title: '點火序列', accent: '#ffa45c',
    body: '33 具引擎由中央往外分批點火。推力穩定之前，夾具把箭體扣在發射台上，水幕同時從台面下噴出，吸收熱與聲波。',
    stats: [['74.4 MN', '海平面推力'], ['3 → 10 → 20', '點火順序']] },
  { id: 'lift', t0: 2.5, t1: 10, code: 'LIFTOFF', title: '起飛', accent: '#ffa45c',
    body: `推重比只有 ${TWR.toFixed(2)}，前幾秒爬升很慢：每秒只多 ${((TWR - 1) * 9.81).toFixed(1)} m/s。隨著推進劑燒掉、箭體變輕，加速度會一路上升。`,
    stats: [[`${TWR.toFixed(2)}`, '起飛推重比'], [`${fmtNum(LIFTOFF_MASS)} t`, '起飛質量']] },
  { id: 'turn', t0: 10, t1: 26, code: 'GRAVITY TURN', title: '重力轉彎', accent: '#e8edf5',
    body: '離塔後只把推力偏轉 2.6°，之後推力一直順著速度方向。重力自己把航跡慢慢壓彎，箭身攻角接近零，不必承受側向氣動力。',
    stats: [['2.6°', '初始偏轉'], ['≈ 0°', '攻角']] },
  { id: 'maxq', t0: EV.maxQ - 9, t1: EV.maxQ + 6, code: 'MAX-Q', title: '最大動壓', accent: '#ffd166',
    body: `動壓 q = ½ρv²。速度一直變大、空氣一直變稀，兩者相乘在 ${(EV.maxQAlt / 1000).toFixed(1)} km 達到峰值。引擎在這段節流到 72%，降低結構負荷。`,
    stats: [[`${(EV.maxQVal / 1000).toFixed(1)} kPa`, '峰值動壓'], [`T+${Math.round(EV.maxQ)} s`, '發生時間']] },
  { id: 'sun', t0: EV.sunlit - 1, t1: EV.sunlit + 14, code: 'SUNLIT', title: '先看見日出', accent: '#ffa45c',
    body: '地面還沒天亮，太陽在地平線下 3°。火箭升過約 8.7 km 的地球陰影高度後，箭身和尾跡先被朝陽照亮，在暗藍天空裡發光。這是黎明與黃昏發射特有的景象。',
    stats: [['8.7 km', '陰影高度'], ['−3°', '太陽仰角']] },
  { id: 'plume', t0: 74, t1: 112, code: 'PLUME', title: '尾焰張開', accent: '#9cc9ff',
    body: `噴嘴出口壓力是固定的，外界氣壓卻隨高度指數下降。到 20 km 只剩海平面的 ${(EV.p20 * 100).toFixed(0)}%，欠膨脹的廢氣向四周張開，尾焰變成越來越寬的水母形。`,
    stats: [[`${(EV.p20 * 100).toFixed(0)}%`, '20 km 氣壓'], ['p = p₀e^(−h/H)', '氣壓模型']] },
  { id: 'meco', t0: EV.meco - 6, t1: EV.shipIgn, code: 'MECO', title: '主引擎關閉', accent: '#e8edf5',
    body: `Most Engines Cut Off：外圈 20 具與中圈 10 具熄火，只留中央 3 具。此刻高度 ${(EV.mecoAlt / 1000).toFixed(0)} km，速度 ${fmtNum(EV.mecoV * 3.6)} km/h。`,
    stats: [[`${(EV.mecoAlt / 1000).toFixed(0)} km`, '高度'], [`${fmtNum(EV.mecoV * 3.6)}`, 'km/h']] },
  { id: 'hot', t0: EV.shipIgn, t1: EV.sep + 7, code: 'HOT STAGING', title: '熱分離', accent: '#ffa45c',
    body: '二級的 6 具引擎在分離之前就點火，廢氣從級間環的排氣口噴出。二級的推力直接把兩節推開，也讓推進劑一直貼在儲槽底部。',
    stats: [['6', '二級引擎'], [`${(EV.sep - EV.shipIgn).toFixed(1)} s`, '點火到分離']] },
  { id: 'bb', t0: EV.sep + 7, t1: EV.sep + 26, code: 'BOOSTBACK', title: '一級翻轉返航', accent: '#9cc9ff',
    body: '一級翻轉 180°，重新點燃 13 具引擎往發射場方向推，抵銷往下游的水平速度，準備飛回發射塔讓機械臂接住。',
    stats: [['13', '返航點火引擎'], ['180°', '翻轉']] },
  { id: 'karman', t0: EV.karman - 8, t1: EV.karman + 16, code: 'KÁRMÁN LINE', title: '越過卡門線', accent: '#9cc9ff',
    body: `100 km：國際航空聯合會採用的太空邊界。這裡的空氣密度只剩海平面的 ${(Math.exp(-100000 / 8500) * 100).toFixed(4)}%，天空完全變黑，地平線只剩一條發光的大氣薄邊。`,
    stats: [['100 km', '高度'], [`T+${Math.round(EV.karman)} s`, '抵達時間']] },
  { id: 'coast', t0: EV.karman + 16, t1: EV.seco - 12, code: 'SHIP BURN', title: '二級加速', accent: '#e8edf5',
    body: '真空中沒有空氣阻力，推力幾乎全部變成速度。二級把航跡逐漸壓平，從往上爬改成往前衝，水平速度每分鐘增加約 4,000 km/h。',
    stats: [['真空', '阻力 ≈ 0'], ['3 + 3', '海平面＋真空引擎']] },
  { id: 'seco', t0: EV.seco - 12, t1: EV.end + 10, code: 'SECO', title: '二級關機', accent: '#ffd166',
    body: `速度 ${fmtNum(EV.secoV * 3.6)} km/h、高度 ${(EV.secoAlt / 1000).toFixed(0)} km。引擎熄火，太空船進入滑行。一路往東飛，下方的地球已經進入白天，晨昏線留在身後。`,
    stats: [[`${fmtNum(EV.secoV * 3.6)}`, 'km/h'], [`${(EV.secoAlt / 1000).toFixed(0)} km`, '高度']] }
];

export function phaseOf(t) {
  if (t < -3) return '推進劑加注完成 · 等待點火';
  if (t < 0) return '引擎點火序列';
  if (t < 9) return '起飛';
  if (t < EV.maxQ - 8) return '重力轉彎';
  if (t < EV.maxQ + 6) return '最大動壓 · MAX-Q';
  if (t < EV.meco - 2) return '超音速爬升';
  if (t < EV.shipIgn) return 'MECO';
  if (t < EV.sep + 6) return '熱分離';
  if (t < EV.karman) return '二級爬升';
  if (t < EV.seco) return '太空 · 二級加速';
  return 'SECO · 次軌道滑行';
}

export const MILESTONES = [
  { t: 0, label: '起飛' }, { t: EV.maxQ, label: 'MAX-Q' }, { t: EV.meco, label: 'MECO' }, { t: EV.karman, label: '100 KM' }, { t: EV.seco, label: 'SECO' }
];

export const LAYERS = [
  { name: '對流層', from: 0, to: 12000 }, { name: '平流層', from: 12000, to: 50000 }, { name: '中氣層', from: 50000, to: 85000 },
  { name: '增溫層', from: 85000, to: 400000 }, { name: '卡門線', sub: '100 km', from: 100000, to: 100000, karman: true }
];

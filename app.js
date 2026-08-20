// ============================================================
// 明日方舟基建模拟器 - 主交互逻辑
// ============================================================

// --- 常量配置 ---
const ROOM_META = {
  CONTROL:     { name: '控制中枢', icon: '🎛️', emoji: '◈' },
  MANUFACTURE: { name: '制造站',   icon: '⚙️',  emoji: '⚙' },
  TRADING:     { name: '贸易站',   icon: '📦',  emoji: '◆' },
  POWER:       { name: '发电站',   icon: '⚡',  emoji: '⚡' },
  DORMITORY:   { name: '宿舍',     icon: '🏠',  emoji: '◇' },
  HIRE:        { name: '办公室',   icon: '📋',  emoji: '▷' },
  TRAINING:    { name: '训练室',   icon: '🏋️', emoji: '▶' },
  MEETING:     { name: '会客室',   icon: '☕',  emoji: '◉' },
  WORKSHOP:    { name: '加工站',   icon: '🔨',  emoji: '◈' },
};

const PRODUCT_MAP = {
  MANUFACTURE: { GOLD: '赤金', EXP: '经验', ORUNDUM: '搓玉' },
  TRADING: { GOLD: '赤金', ORUNDUM: '搓玉' }
};

/** 制造站技能绑定的产物；null = 全产物通用（与引擎一致） */
function getManuSkillProduct(skill) {
  return engine.getManufactureSkillProduct?.(skill) ?? null;
}

/** 按当前产物估算制造技能满配峰值（排序用；条件不够时实际更低） */
function scoreManufactureSkill(skill, product) {
  const tag = getManuSkillProduct(skill);
  if (tag && tag !== product) return 0;
  const bid = skill.buffId || '';
  const d = skill.desc || '';

  // 玛露西尔：魔物料理，森西进 Lv5 宿舍满配 5
  if (bid === 'manu_prod_spd_bd[400]') {
    return Math.max(engine.getMonsterCuisineCount?.() ?? 0, 5);
  }
  // 黍等：人间烟火
  if (bid === 'manu_prod_spd_bd[300]' || (/人间烟火/.test(d) && /生产力/.test(d) && /每\d*点/.test(d))) {
    return Math.max(engine.getHumanFireworksCount?.() ?? 0, 40);
  }
  // 发电站数：满配按 3 站估
  if (bid.startsWith('manu_prod_spd&power')) {
    const now = engine.getEffectivePowerCount?.() ?? 0;
    const n = Math.max(now, 3);
    const per = bid === 'manu_prod_spd&power[020]' ? 15 : bid === 'manu_prod_spd&power[010]' ? 10 : 5;
    return n * per;
  }
  // 贸易站数：满配按 3 站估
  if (bid === 'manu_prod_spd&trade[000]') {
    return Math.max(engine.layout.TRADING?.length || 0, 3) * 20;
  }
  if (bid === 'manu_prod_spd&trade[1000]') {
    return Math.max(engine.layout.TRADING?.length || 0, 3) * 3;
  }
  if (bid.startsWith('manu_token_prod_spd')) {
    const per = bid === 'manu_token_prod_spd[010]' ? 10 : 5;
    const now = engine.getWorkPlatformCountInPower?.() ?? 0;
    return Math.max(now, 3) * per;
  }
  if (bid === 'manu_formula_spd&dorm&lv[000]') {
    return Math.max(engine.getDormLevelSum?.() ?? 0, 20);
  }
  if (bid === 'manu_formula_spd&cost_bd[100]') return 5 * 3; // 莱茵满 5
  if (bid === 'manu_formula_spd&cost_bd[000]') return 3 * 2; // 黑钢满 3
  if (bid === 'manu_prod_spd_train&lv[000]') return 30;
  if (bid === 'manu_formula_spd_P[000]') return 35; // 烈夏需古米在贸易
  if (bid === 'manu_formula_spd&bd[001]') return 40; // 怒潮+乌萨斯学生
  if (bid === 'manu_formula_spd&bd[000]') return 30;
  if (bid === 'manu_prod_spd_variable2[000]') return 40; // 槐琥配合意识封顶
  if (bid === 'manu_prod_spd_addition[100]') return 20; // 阿罗玛
  if (bid === 'manu_prod_cost_min[001]') return 10; // 机械师满 12h
  if (bid.startsWith('manu_prod_spd_addition')) return 25;
  if (bid === 'manu_prod_spd_variable3[000]') return 48; // 泡泡库容峰值粗估
  if (bid === 'manu_prod_spd_variable[000]' || bid === 'manu_prod_spd_P[008]') return 30;
  // 冬时等：每名干员 +10%
  if (bid.startsWith('manu_prod_spd&manu')) {
    const per = bid.includes('[100]') ? 10 : 0;
    return per * 3; // 满员 3 人
  }
  // 多萝西/水月/苍苔：每类技能计数
  if (bid.startsWith('manu_skill_spd1') || /每个(?:莱茵科技|金属工艺|标准化|红松)/.test(d)) {
    const per = +(d.match(/为自身\+(\d+(?:\.\d+)?)%/) || d.match(/\+(\d+(?:\.\d+)?)%的生产力/) || [])[1]
      || (typeof skill.efficiency === 'number' ? skill.efficiency : 5);
    return per * 4; // 满配约 4 个同类技能
  }
  // A1 / 系列：当前站每人
  if (bid.startsWith('manu_prod_spd&fraction') || /每个A1小队|每个骑士/.test(d)) {
    const per = +(d.match(/为自身\+(\d+(?:\.\d+)?)%/) || [])[1] || 10;
    return per * 3;
  }
  if (bid === 'manu_prod_spd_bd[100]' || bid === 'manu_prod_spd_bd[110]') {
    const robots = Math.min(64, (engine.getFacilityTotalLevel?.(null) ?? 40) + 3);
    const divisor = bid === 'manu_prod_spd_bd[110]' ? 8 : 16;
    return Math.floor(robots / divisor) * 5;
  }
  // 点名同站：生产力+X%（阿兰娜/酒神等）
  if (/当与[^，。；]{1,12}在同一个制造站|若古米在贸易站/.test(d)) {
    const m = d.match(/生产力\+(\d+(?:\.\d+)?)%/);
    return m ? +m[1] : Math.max(0, skill.efficiency || 0);
  }
  // 纯机制（意识兼容等）
  if (bid === 'manu_skill_change[000]' || bid === 'manu_constrLv[000]' || bid === 'manu_bd_to_bd[000]') {
    return 0;
  }
  if (bid.startsWith('manu_prod_spd_bd_n1') || /感知信息|思维链环/.test(d)) {
    return Math.max(engine.layout.DORMITORY?.reduce((s, r) => s + (r.operators || []).filter(Boolean).length, 0) || 0, 20);
  }
  const eff = typeof skill.efficiency === 'number' ? skill.efficiency : 0;
  // efficiency 字段若是每单位加成（1%/点），文案有「每」则勿当总量
  if (eff > 0 && eff <= 5 && /每\d*点|每间|每个|每名/.test(d) && !/生产力\+(\d{2,})%/.test(d)) {
    // 已在上面分支处理；落到这里则按粗估
    if (/宿舍/.test(d)) return Math.max(engine.getDormLevelSum?.() ?? 0, 20) * eff;
  }
  return Math.max(0, eff);
}

function peakNeedFromManuSkill(skill) {
  const bid = skill.buffId || '';
  const d = skill.desc || '';
  if (bid === 'manu_skill_change[000]' || bid === 'manu_constrLv[000]' || bid === 'manu_bd_to_bd[000]') return '机制·不计效率';
  if (bid.startsWith('manu_prod_spd_bd_n1') || /感知信息|思维链环/.test(d)) return '靠宿舍人数';
  if (bid.startsWith('manu_prod_spd&manu')) return '靠同站人数';
  if (bid.startsWith('manu_skill_spd1') || /每个(?:莱茵科技|金属工艺|标准化)/.test(d)) return '靠同站技能数';
  if (bid.startsWith('manu_prod_spd&fraction')) return '靠小队人数';
  if (bid === 'manu_prod_spd_bd[300]' || /人间烟火/.test(d)) return '靠人间烟火';
  if (bid === 'manu_prod_spd_bd[400]') return '需森西料理';
  if (bid.startsWith('manu_prod_spd&power')) return '靠发电站数';
  if (bid === 'manu_prod_spd&trade[000]' || bid === 'manu_prod_spd&trade[1000]') return '靠贸易站数';
  if (bid.startsWith('manu_token_prod_spd')) return '靠作业平台';
  if (bid === 'manu_formula_spd&dorm&lv[000]') return '靠宿舍等级';
  if (bid === 'manu_prod_spd_train&lv[000]') return '靠训练室等级';
  if (bid === 'manu_formula_spd_P[000]') return '需古米在贸易';
  if (/当与温米|当与酒神|当与[^，。；]{1,8}在同一个/.test(d)) return '需点名同站';
  if (/莱茵生命|黑钢国际|乌萨斯学生|深海猎人|骑士干员/.test(d)) return '靠系列人数';
  if (/金属工艺|标准化|莱茵科技|红松|其他干员提供的|配合意识/.test(d)) return '靠同站搭配';
  if (bid === 'manu_prod_spd_addition[100]') return '需工时满额';
  if (bid === 'manu_prod_cost_min[001]') return '需连干12h';
  if (bid.startsWith('manu_prod_spd_addition')) return '需工时满额';
  return '';
}

/**
 * 制造站干员库分类（看该干员全部制造技能描述，再结合当前产物）
 * lane: special=专项(当前产物) | generic=通用 | mismatch=其它产物 | none
 * mode: solo=单人效率 | synergy=有搭配
 * synKind: need_partner=需要配 | small_team=一到二人 | series=搭配系列
 */
function classifyManufactureOpForList(char, product) {
  const skills = engine.getActiveSkills(char.id).filter(s => s.roomType === 'MANUFACTURE');
  if (!skills.length) {
    return { lane: 'none', mode: null, synKind: null, series: null, score: 0, cap: 0, kind: 'none' };
  }

  let score = 0;
  let cap = 0;
  let hasSpecial = false;
  let hasGeneric = false;
  let hasAnyApplicable = false;
  let synKind = null; // need_partner | small_team | series
  let series = null;
  let peakNeed = '';
  let note = '';

  const preferSyn = (next) => {
    const rank = { series: 3, need_partner: 2, small_team: 1 };
    if (!synKind || (rank[next] || 0) > (rank[synKind] || 0)) synKind = next;
  };

  for (const s of skills) {
    cap = Math.max(cap, typeof s.capacity === 'number' ? s.capacity : 0);
    const tag = getManuSkillProduct(s);
    const d = s.desc || '';

    // —— 搭配类型：两技能描述一起看 ——
    if (/若古米在贸易站|当与温米在同一个|当与酒神在同一个/.test(d)
        || /当与[^，。；]{1,8}在同一个制造站/.test(d)) {
      preferSyn('need_partner');
    }
    if (/莱茵生命干员/.test(d)) {
      preferSyn('series');
      series = '莱茵生命';
    } else if (/黑钢国际干员/.test(d)) {
      preferSyn('series');
      series = '黑钢国际';
    } else if (/乌萨斯学生自治团/.test(d)) {
      preferSyn('series');
      series = '乌萨斯学生自治团';
    } else if (/深海猎人/.test(d)) {
      preferSyn('series');
      series = '深海猎人';
    } else if (/骑士干员/.test(d)) {
      preferSyn('series');
      series = '骑士';
    }
    if (/金属工艺类技能|标准化类技能|莱茵科技类技能|红松骑士团类/.test(d)
        || /其他干员提供的每5%生产力|当前制造站内其他干员提供的生产力/.test(d)
        || /当前制造站内每个/.test(d) && /为自身/.test(d)) {
      if (synKind !== 'series' && synKind !== 'need_partner') preferSyn('small_team');
    }

    if (tag && tag !== product) continue; // 对本产物不生效的专精技，不参与排序分
    hasAnyApplicable = true;
    if (tag === product) hasSpecial = true;
    else hasGeneric = true;
    const sc = scoreManufactureSkill(s, product);
    if (sc >= score) {
      score = sc;
      const need = peakNeedFromManuSkill(s);
      if (need) peakNeed = need;
      if (s.buffId === 'manu_prod_spd_bd[400]') {
        const now = engine.getMonsterCuisineCount?.() ?? 0;
        note = `魔物料理满配+${sc}%（当前${now}；森西进Lv5宿舍）`;
      } else if (need) {
        note = `满配峰值 +${sc}%（${need}）`;
      }
    }
  }

  if (!hasAnyApplicable) {
    return {
      lane: 'mismatch', mode: null, synKind: null, series: null,
      score: 0, cap, kind: 'mismatch', peakNeed: '', note: '',
    };
  }

  const lane = hasSpecial ? 'special' : 'generic';
  const mode = synKind ? 'synergy' : 'solo';
  // 兼容旧字段 kind（别处若仍引用）
  const kind = lane === 'special' ? 'match' : (mode === 'synergy' ? 'synergy' : 'generic');
  if (!peakNeed && synKind === 'need_partner') peakNeed = '需点名同站';
  else if (!peakNeed && synKind === 'series') peakNeed = '靠系列人数';
  else if (!peakNeed && synKind === 'small_team') peakNeed = '靠同站搭配';
  return { lane, mode, synKind, series, score, cap, kind, peakNeed, note };
}

function estimateManufactureSort(char, product) {
  return classifyManufactureOpForList(char, product);
}

const RARITY_COLOR = {
  1: '#9e9e9e', 2: '#8bc34a', 3: '#03a9f4',
  4: '#9c27b0', 5: '#ff9800', 6: '#f44336',
};

const PROFESSION_CN = {
  MEDIC: '医疗', WARRIOR: '近卫', SNIPER: '狙击',
  TANK: '重装', SUPPORT: '辅助', CASTER: '术师',
  SPECIAL: '特种', PIONEER: '先锋',
};

const PROFESSION_COLOR = {
  MEDIC:   { bg: 'rgba(76,175,80,.22)',   fg: '#81c784', bd: 'rgba(76,175,80,.55)' },
  WARRIOR: { bg: 'rgba(244,67,54,.22)',   fg: '#ef9a9a', bd: 'rgba(244,67,54,.55)' },
  SNIPER:  { bg: 'rgba(255,193,7,.22)',   fg: '#ffd54f', bd: 'rgba(255,193,7,.55)' },
  TANK:    { bg: 'rgba(33,150,243,.22)',  fg: '#64b5f6', bd: 'rgba(33,150,243,.55)' },
  SUPPORT: { bg: 'rgba(156,39,176,.22)',  fg: '#ce93d8', bd: 'rgba(156,39,176,.55)' },
  CASTER:  { bg: 'rgba(0,188,212,.22)',   fg: '#4dd0e1', bd: 'rgba(0,188,212,.55)' },
  SPECIAL: { bg: 'rgba(255,87,34,.22)',   fg: '#ffab91', bd: 'rgba(255,87,34,.55)' },
  PIONEER: { bg: 'rgba(255,152,0,.22)',   fg: '#ffb74d', bd: 'rgba(255,152,0,.55)' },
};

const PROFESSION_ORDER = ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种', '通用', '其他'];

function getProfessionLabel(char) {
  if (!char) return '未知';
  if (typeof PROFESSION_MAP !== 'undefined' && PROFESSION_MAP[char.profession]) {
    return PROFESSION_MAP[char.profession];
  }
  return PROFESSION_CN[char.profession] || char.profession || '未知';
}

function getProfessionStyle(char) {
  return PROFESSION_COLOR[char?.profession] || { bg: 'rgba(255,255,255,.08)', fg: '#b0bec5', bd: 'rgba(255,255,255,.2)' };
}

/**
 * 对照指定设施：该干员该设施技能「完整版」所需精英等级
 * 取各技能槽最高 eliteReq；无对应技能返回 null
 */
function getFacilityEliteNeed(char, roomType) {
  if (!char || !roomType) return null;
  const roomSkills = (char.skills || []).filter(s => s.roomType === roomType);
  if (!roomSkills.length) return null;
  // 孑特例：跟随开关
  if (char.name === '孑' && roomType === 'TRADING') {
    return engine.jayElite2 ? 1 : 0; // 市井之道为精一
  }
  const bySlot = {};
  for (const s of roomSkills) {
    const prev = bySlot[s.slotIdx];
    if (!prev || s.eliteReq > prev.eliteReq ||
        (s.eliteReq === prev.eliteReq && (s.levelReq || 0) > (prev.levelReq || 0))) {
      bySlot[s.slotIdx] = s;
    }
  }
  return Math.max(...Object.values(bySlot).map(s => s.eliteReq || 0));
}

function formatEliteNeed(elite) {
  if (elite == null) return null;
  if (elite <= 0) return { text: '精0', cls: 'elite-need-0' };
  if (elite === 1) return { text: '精一', cls: 'elite-need-1' };
  return { text: '精二', cls: 'elite-need-2' };
}

/** 会客室排序分：默认精二。本体(稀有度+精二16%+非涣散5%) + 技能峰值；跃跃/响石默认计交流 */
function estimateMeetingScore(char) {
  const rarityB = engine.getMeetingRarityBonus(char.rarity);
  const eliteB = engine.getMeetingEliteBonus(2); // 强制按精二（含隐藏+16%，与技能解锁精一无关）
  const focusB = 5;
  const base = rarityB + eliteB + focusB;

  const skills = engine.getActiveSkills(char.id, 2).filter(s => s.roomType === 'MEETING');
  let teamSkill = 0; // 可叠加的速度技能之和（如莱欧斯好奇心+饱餐）
  let soloSkill = 0;
  let kind = 'none';
  let note = '';

  const intel = engine.getIntelReserveCount();
  const food = engine.getMonsterCuisineCount();
  const intelPeak = Math.max(intel, 4);
  const foodPeak = Math.max(food, 5);

  for (const s of skills) {
    const d = s.desc || '';
    const bid = s.buffId || '';

    if (bid === 'meet_spd_hast[000]') {
      teamSkill += 30;
      kind = 'speed';
      continue;
    }

    if (bid === 'meet_spd_bd[000]') {
      const now = 5 + intel * 5;
      const peak = 5 + intelPeak * 5;
      teamSkill += peak;
      kind = 'speed';
      note = intel > 0
        ? `情报储备${intel}→技能+${now}%（满配参考+${peak}%）`
        : `配彩虹中枢永动+灰烬，满配技能+${peak}%`;
      continue;
    }

    if (bid === 'meet_spd_bd[001]') {
      const now = food * 2;
      const peak = foodPeak * 2;
      teamSkill += peak;
      kind = 'speed';
      note = (note ? note + '；' : '') + (food > 0
        ? `魔物料理${food}→额外+${now}%（森西Lv5参考+${peak}%）`
        : `配森西进宿舍，Lv5额外+${peak}%`);
      continue;
    }

    if (bid === 'meet_spd_bd[002]') {
      const fire = engine.getHumanFireworksCount?.() ?? 0;
      const now = 20 + Math.floor(fire / 10);
      const peak = 20 + 3; // 约30点烟火参考
      teamSkill += Math.max(now, peak);
      kind = 'speed';
      note = (note ? note + '；' : '') + `人间烟火${fire}→+${now}%`;
      continue;
    }

    if (bid === 'meet_spd_ext&P[000]') {
      const ok = engine.hasOperatorInRoomType?.('菲亚梅塔', 'DORMITORY');
      teamSkill += ok ? 10 : 10; // 排序按峰值，便于找到
      kind = 'speed';
      note = (note ? note + '；' : '') + (ok ? '菲亚梅塔在宿舍+10%' : '需菲亚梅塔进宿舍+10%');
      continue;
    }

    if (bid === 'meet_spd&bd[100]') {
      teamSkill += 30;
      kind = 'speed';
      note = (note ? note + '；' : '') + '需铃兰同站+30%';
      continue;
    }

    if (bid === 'meet_spd&clue[000]') {
      const slots = engine.getExtraRecruitSlots?.() ?? 0;
      const peakSlots = Math.max(slots, 2);
      teamSkill += peakSlots * 5;
      kind = 'speed';
      note = (note ? note + '；' : '') + `额外招募位峰值${peakSlots}（初始2不含）`;
      continue;
    }

    // 跃跃 / 响石：默认按「线索交流中」计入速度；其余交流/倾向技仍进派系组
    if (bid.startsWith('meet_spd&exchange')) {
      const peakM = d.match(/线索搜集速度提升(\d+(?:\.\d+)?)%/);
      const peak = peakM ? +peakM[1] : 0;
      if ((char.name === '跃跃' || char.name === '响石') && peak > 0) {
        teamSkill += peak;
        kind = 'speed';
        note = (note ? note + '；' : '') + '默认线索交流中';
      } else if (kind === 'none') {
        kind = 'bias';
      }
      continue;
    }
    if (bid === 'meet_spd_notOwned&exchange[000]'
        || bid === 'meet_team&char[000]' || bid.startsWith('meet_spd&condChar_mustget')) {
      if (kind === 'none') kind = 'bias';
      continue;
    }

    const solo = /只有自身处于工作状态/.test(d);
    const speedM = d.match(/线索搜集速度提升(\d+(?:\.\d+)?)%/);
    // 人间烟火：单独按峰值层数估，避免再被「额外提升」正则重复加上
    const humanFire = d.match(/每(\d+)点人间烟火额外提升(\d+(?:\.\d+)?)%/);
    const extraM = !humanFire && d.match(/额外提升(\d+(?:\.\d+)?)%/);
    if (speedM) {
      let peak = +speedM[1];
      if (extraM) peak += +extraM[1];
      if (humanFire) {
        const step = +humanFire[1] || 10;
        const per = +humanFire[2];
        peak += per * Math.floor(30 / step);
        note = (note ? note + '；' : '') + `含人间烟火峰值约+${per * Math.floor(30 / step)}%`;
      }
      // 同站/系列「每名 +X%」按满员粗估
      const perName = d.match(/每(?:有)?(?:1)?名[^，。；]{0,12}(?:干员)?[^，。；]{0,8}\+(\d+(?:\.\d+)?)%/);
      if (perName && !extraM) {
        peak = Math.max(peak, +speedM[1] + (+perName[1]) * 2);
        note = (note ? note + '；' : '') + '含同站人数满配';
      }
      if (solo) soloSkill = Math.max(soloSkill, peak);
      else teamSkill += peak;
      continue;
    }

    if (/更容易获得|线索倾向|线索板上|额外增加/.test(d)) {
      if (kind === 'none') kind = 'bias';
    }
  }

  let skillPeak;
  if (soloSkill > teamSkill) {
    skillPeak = soloSkill;
    kind = 'solo';
  } else {
    skillPeak = teamSkill;
    if (skillPeak > 0) kind = 'speed';
  }

  // 卡片短提示：满配峰值的关键条件（避免只看数字误以为白嫖）
  let peakNeed = '';
  if (/铃兰/.test(note)) peakNeed = '需铃兰';
  else if (/菲亚梅塔/.test(note)) peakNeed = '需菲亚梅塔';
  else if (/情报储备|灰烬|彩虹/.test(note)) peakNeed = '需灰烬情报';
  else if (/魔物料理|森西/.test(note)) peakNeed = '需森西料理';
  else if (/人间烟火/.test(note)) peakNeed = '含烟火峰值';
  else if (/线索交流/.test(note)) peakNeed = '交流中';
  else if (/招募位|骋风/.test(note)) peakNeed = '靠额外招募位';
  else if (/独处/.test(note) || kind === 'solo') peakNeed = '需独处';

  return {
    score: base + skillPeak,
    base,
    rarityB,
    skillPeak,
    kind,
    note,
    peakNeed,
  };
}

/** 办公室排序分：联络速度满配峰值（锡人按宿舍、乌有按额外招募位说明） */
function estimateHireScore(char) {
  const skills = engine.getActiveSkills(char.id, 2).filter(s => s.roomType === 'HIRE');
  if (!skills.length) return { score: 0, skillPeak: 0, kind: 'none', note: '', peakNeed: '' };

  const dormNow = engine.getDormLevelSum();
  const dormPeak = Math.max(dormNow, 20); // 4×Lv5
  const extraNow = engine.getExtraRecruitSlots();
  const extraPeak = Math.max(extraNow, 2); // Lv3 办公室

  let contact = 0;
  let kind = 'none';
  let note = '';
  let peakNeed = '';

  for (const s of skills) {
    const bid = s.buffId || '';
    const d = s.desc || '';

    if (bid.startsWith('hire_spd_dorm&lv')) {
      const per = bid.includes('[010]') ? 2 : 1;
      const peak = 5 + dormPeak * per;
      if (peak > contact) {
        contact = peak;
        note = `+5% + 宿舍等级峰值${dormPeak}×${per}%（当前宿舍合计${dormNow}→+${5 + dormNow * per}%）`;
        peakNeed = '靠宿舍等级';
        kind = 'speed';
      }
      continue;
    }

    if (bid === 'hire_spd&clue[101]' || bid === 'hire_spd&clue[100]'
        || bid === 'hire_spd&clue[110]' || bid === 'hire_spd&clue[120]' || bid === 'hire_spd&clue[121]'
        || (/会客室线索/.test(d) && /招募位/.test(d) && /联络速度/.test(d))) {
      const m = d.match(/联络速度\+(\d+(?:\.\d+)?)%/);
      const c = m ? +m[1] : 35;
      const meetPeak = extraPeak * 5;
      if (c >= contact) {
        contact = c;
        note = `联络+${c}%（办公室等级决定额外招募位，初始2不含）；满配会客线索+${meetPeak}%（当前额外${extraNow}→会客+${extraNow * 5}%）。与会客室等级无关。`;
        peakNeed = `会客峰+${meetPeak}`;
        kind = 'speed';
      }
      continue;
    }

    // 每额外招募位直接加联络（非拐会客）
    if (bid.startsWith('hire_spd_cost&extra') || (/每个招募位/.test(d) && /联络速度/.test(d) && !/会客室/.test(d) && !/人间烟火|记忆碎片|无声/.test(d))) {
      const per = +(d.match(/\+(\d+(?:\.\d+)?)%人脉/) || d.match(/\+(\d+(?:\.\d+)?)%/) || [])[1] || 10;
      const peak = extraPeak * per;
      if (peak > contact) {
        contact = peak;
        note = `额外招募位×${per}% → 满配 +${peak}%`;
        peakNeed = '靠额外招募位';
        kind = 'speed';
      }
      continue;
    }

    // 精英设施数
    if (bid.startsWith('hire_spd_tag') || /进驻精英干员的设施/.test(d)) {
      const base = +(d.match(/联络速度\+(\d+(?:\.\d+)?)%/) || [])[1] || 30;
      const per = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 4;
      const maxN = +(d.match(/最多(\d+)间/) || [])[1] || 3;
      const peak = base + per * maxN;
      if (peak > contact) {
        contact = peak;
        peakNeed = '靠精英设施数';
        kind = 'speed';
      }
      continue;
    }

    // 闪击：情报+特饮
    if (bid.startsWith('hire_spd_blitz') || (/情报储备/.test(d) && /乌萨斯特饮/.test(d))) {
      const base = +(d.match(/联络速度\+(\d+(?:\.\d+)?)%/) || [])[1] || 20;
      const peak = base + 4 * 5 + 2 * 5; // 情报满4 + 特饮粗估2
      if (peak > contact) {
        contact = peak;
        peakNeed = '靠情报/特饮';
        kind = 'speed';
      }
      continue;
    }

    // 圣聆初雪等：点名中枢额外
    if (bid.startsWith('hire_spd_cost&char') || (/控制中枢/.test(d) && /联络速度额外/.test(d))) {
      const base = +(d.match(/联络速度\+(\d+(?:\.\d+)?)%/) || [])[1] || 35;
      const extra = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 10;
      if (base + extra > contact) {
        contact = base + extra;
        peakNeed = '需点名中枢';
        kind = 'speed';
      }
      continue;
    }

    // 桑葚人间烟火：无联络
    if (bid.startsWith('hire_spd_bd_n1_n1[200]') || (/人间烟火/.test(d) && !/联络速度/.test(d))) {
      if (kind === 'none') kind = 'bias';
      note = (note ? note + '；' : '') + `额外位→人间烟火（无联络%）`;
      peakNeed = peakNeed || '产烟火';
      continue;
    }

    if (/联络速度\+(\d+(?:\.\d+)?)%/.test(d)) {
      const m = d.match(/联络速度\+(\d+(?:\.\d+)?)%/);
      const c = m ? +m[1] : (s.efficiency || 0);
      if (c > contact) {
        contact = c;
        kind = 'speed';
        if (/记忆碎片/.test(d)) {
          note = (note ? note + '；' : '') + '含记忆碎片机制';
          peakNeed = peakNeed || '含记忆碎片';
        }
        if (/线索的概率|乌萨斯|黑钢/.test(d)) {
          peakNeed = peakNeed || '含线索倾向';
          if (kind === 'none') kind = 'bias';
          kind = 'speed';
        }
      }
      continue;
    }

    if (/招募位|记忆碎片|人间烟火|线索/.test(d)) {
      if (kind === 'none') kind = 'bias';
    }
  }

  return {
    score: contact,
    skillPeak: contact,
    base: 0,
    kind: contact > 0 ? 'speed' : kind,
    note,
    peakNeed,
    meetCluePeak: /会客峰\+(\d+)/.test(peakNeed) ? +peakNeed.match(/会客峰\+(\d+)/)[1] : 0,
  };
}

/** 贸易站排序分：满配峰值获取速度 */
function estimateTradingScore(char) {
  const skills = engine.getActiveSkills(char.id, 2).filter(s => s.roomType === 'TRADING');
  if (!skills.length) return { score: 0, kind: 'none', peakNeed: '', note: '' };

  const dormLv = Math.max(engine.getDormLevelSum?.() ?? 0, 20);
  const dormHead = Math.max(
    (engine.layout.DORMITORY || []).reduce((s, r) => s + (r.operators || []).filter(Boolean).length, 0),
    20
  );
  const fire = Math.max(engine.getHumanFireworksCount?.() ?? 0, 40);
  const meetLv = Math.max(engine.layout.MEETING?.[0]?.level || 0, 3);
  let best = 0;
  let kind = 'none';
  let peakNeed = '';
  let note = '';

  const take = (v, need, n = '') => {
    if (v > best) {
      best = v;
      kind = 'speed';
      if (need) peakNeed = need;
      if (n) note = n;
    }
  };

  for (const s of skills) {
    const bid = s.buffId || '';
    const d = s.desc || '';

    // 德克萨斯·恩怨：文案 +65%，efficiency 字段是心情
    if (bid === 'trade_ord_spd&cost_P[000]' || (/拉普兰德/.test(d) && /订单获取效率\+(\d+)/.test(d))) {
      const m = d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/);
      take(m ? +m[1] : 65, '需拉普兰德同站', '恩怨满配');
      continue;
    }
    // 蕾缪安·相伴：20+25
    if (bid === 'trade_ord_spd&multiPar[100]' || (/当与能天使/.test(d) && /额外\+(\d+)/.test(d))) {
      const base = +(d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/) || [])[1] || 20;
      const extra = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 25;
      take(base + extra, '需本体能天使同站');
      continue;
    }
    // 贝洛内 / 深巡：基础 + 点名在基建
    if (bid.startsWith('trade_ord_spd_ext')) {
      const base = +(d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/) || [])[1] || (s.efficiency || 0);
      const extra = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 0;
      const need = /伺夜/.test(d) ? '需伺夜在基建' : (/乌尔比安/.test(d) ? '需乌尔比安在基建' : '需点名在基建');
      take(base + extra, need);
      continue;
    }
    // 摩根：格拉斯哥×20% + 推进之王额外35%
    if (bid === 'trade_ord_spd_par[000]' || (/格拉斯哥帮/.test(d) && /推进之王/.test(d))) {
      const per = +(d.match(/效率\+(\d+(?:\.\d+)?)%/) || [])[1] || 20;
      const extra = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 35;
      take(per * 3 + extra, '需格拉斯哥/推进之王');
      continue;
    }
    // 赫德雷：基础 + 伊内丝/W
    if (bid.startsWith('trade_ord_par&per')) {
      const base = +(d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/) || [])[1] || 30;
      const extras = [...d.matchAll(/额外\+(\d+(?:\.\d+)?)%/g)].reduce((s, m) => s + +m[1], 0)
        || (bid.includes('[001]') ? 10 : 5);
      take(base + extras, '需伊内丝/W在岗');
      continue;
    }
    // 吉星 / 火哨：除自身外每人
    if (bid.startsWith('trade_ord_spd&share')) {
      const per = +(d.match(/\+(\d+(?:\.\d+)?)%订单/) || d.match(/\+(\d+(?:\.\d+)?)%/) || [])[1]
        || (bid.includes('[002]') ? 20 : bid.includes('[000]') ? 15 : 10);
      take(per * 2, '靠同站人数', `另2人满配 +${per * 2}%`);
      continue;
    }
    // 空弦：宿舍等级
    if (bid.startsWith('trade_ord_spd&dorm&lv')) {
      const per = bid.includes('[010]') ? 2 : 1;
      take(dormLv * per, '靠宿舍等级');
      continue;
    }
    // 伺夜 / 渡桥：会客室等级
    if (bid.startsWith('trade_ord_spd&meet') || /会客室每级/.test(d)) {
      const base = +(d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/) || [])[1] || (s.efficiency > 1 ? s.efficiency : 25);
      const per = +(d.match(/会客室每级额外提供(\d+(?:\.\d+)?)%/) || [])[1] || 5;
      const cap = +(d.match(/最多提供(\d+(?:\.\d+)?)%/) || [])[1] || 40;
      take(base + Math.min(cap, meetLv * per), '靠会客室等级');
      continue;
    }
    // 巫恋
    if (bid === 'trade_ord_vodfox[000]') {
      take(35, '巫恋低语');
      continue;
    }
    // 人间烟火转效率（乌有贸易等）
    if (bid.startsWith('trade_ord_spd_bd_n2') || (/人间烟火/.test(d) && /订单获取效率/.test(d))) {
      take(Math.min(dormHead, fire), '靠宿舍人数/烟火');
      continue;
    }
    // 魔物料理
    if (bid.startsWith('trade_ord_spd_bd[100]') || (/魔物料理/.test(d) && /订单/.test(d))) {
      take(Math.max(engine.getMonsterCuisineCount?.() ?? 0, 5), '需森西料理');
      continue;
    }
    // 黑键无声共鸣等
    if (bid.startsWith('trade_ord_spd_bd') && /无声共鸣|感知信息/.test(d)) {
      take(Math.max(20, fire / 2), '靠共鸣层数');
      continue;
    }
    // 风絮·岁设施
    if (bid.startsWith('trade_ord_spd&tag') || (/岁干员的设施/.test(d))) {
      const base = 20;
      const per = +(d.match(/效率\+(\d+(?:\.\d+)?)%/) || [])[1] || 4;
      const maxN = +(d.match(/最多(\d+)间/) || [])[1] || 3;
      take(base + per * maxN, '靠岁设施数');
      continue;
    }
    // 石英：配方种类
    if (bid.startsWith('trade_ord_spd&formula')) {
      const base = +(d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/) || [])[1] || 30;
      take(base + 2 * 3, '靠制造配方种类');
      continue;
    }
    // 鸿雪/绮良生产线
    if (bid.startsWith('trade_ord_spd&gold') || bid.startsWith('trade_ord_line')) {
      const per = +(d.match(/效率\+(\d+(?:\.\d+)?)%/) || [])[1] || (s.efficiency || 5);
      take(Math.max(per * 4, s.efficiency || 0), '靠赤金生产线');
      continue;
    }
    // 投资/违约/倾向：不进速度分
    if (bid.startsWith('trade_ord_long') || bid.startsWith('trade_ord_wt&cost')
        || bid.startsWith('trade_ord_law') || bid.startsWith('trade_ord_against')
        || bid.startsWith('trade_ord_closure') || bid.startsWith('trade_ord_pepe')
        || /投资|违约|不视作|高品质贵金属订单/.test(d)) {
      if (kind === 'none') kind = 'bias';
      if (!peakNeed) peakNeed = /投资/.test(d) ? '投资单均' : (/违约/.test(d) ? '违约机制' : '倾向/机制');
      continue;
    }
    // 通用：文案里的获取效率 + 额外
    const speedM = d.match(/订单获取效率\+(\d+(?:\.\d+)?)%/);
    if (speedM) {
      let v = +speedM[1];
      const extraM = d.match(/额外\+(\d+(?:\.\d+)?)%/);
      if (extraM) {
        v += +extraM[1];
        peakNeed = peakNeed || '含点名额外';
      }
      if (/每有|每名|同个贸易站中每/.test(d) && !extraM) {
        const per = +(d.match(/\+(\d+(?:\.\d+)?)%/) || [])[1] || v;
        v = Math.max(v, per * 2);
        peakNeed = peakNeed || '靠同站人数';
      }
      take(v, peakNeed);
      continue;
    }

    if (/每有|每名|当与|搭配|宿舍|会客室|基建内/.test(d)) {
      if (kind === 'none') kind = 'bias';
      if (!peakNeed) peakNeed = '有搭配条件';
    }
  }

  return { score: best, kind: best > 0 ? 'speed' : kind, peakNeed, note };
}

/** 发电站排序分：满配峰值充能 */
function estimatePowerScore(char) {
  const skills = engine.getActiveSkills(char.id, 2).filter(s => s.roomType === 'POWER');
  if (!skills.length) return { score: 0, kind: 'none', peakNeed: '', note: '' };

  const dormLv = Math.max(engine.getDormLevelSum?.() ?? 0, 20);
  let best = 0;
  let kind = 'none';
  let peakNeed = '';
  let note = '';

  for (const s of skills) {
    const bid = s.buffId || '';
    const d = s.desc || '';
    let v = 0;

    if (bid === 'power_rec_drone[000]') {
      v = 25;
      peakNeed = '靠无人机上限';
      note = '巡线框架满配 +25%';
    } else if (bid === 'power_count[000]') {
      kind = kind === 'none' ? 'bias' : kind;
      peakNeed = peakNeed || '晨曦·加设施数';
      note = '不提供充能，增加有效发电站数';
      continue;
    } else if (bid.startsWith('power_rec_spd&dorm&lv')) {
      const per = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 0.5;
      v = dormLv * per;
      peakNeed = '靠宿舍等级';
    } else if (bid.startsWith('power_rec_spd&addition') || /最终达到/.test(d)) {
      const m = d.match(/最终达到\+(\d+(?:\.\d+)?)%/) || d.match(/达[到至]\+(\d+(?:\.\d+)?)%/);
      v = m ? +m[1] : 20;
      peakNeed = '需工时满额';
    } else if (bid.startsWith('power_rec_rhine') || (/莱茵生命干员/.test(d) && /充能/.test(d))) {
      const base = +(d.match(/充能速度\+(\d+(?:\.\d+)?)%/) || [])[1] || 10;
      const per = +(d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 3;
      const maxN = +(d.match(/最多(\d+)名/) || [])[1] || 5;
      v = base + per * maxN;
      peakNeed = '靠莱茵人数';
    } else if (bid.startsWith('power_rec_spd_ext') || /如果其他|如果凯尔希|如果逻各斯/.test(d)) {
      const base = +(d.match(/充能速度\+(\d+(?:\.\d+)?)%/) || [])[1] || 0;
      const extra = +(d.match(/则(?:无人机)?充能速度\+(\d+(?:\.\d+)?)%/) || d.match(/\+(\d+(?:\.\d+)?)%/) || [])[1]
        || (typeof s.efficiency === 'number' ? s.efficiency : 5);
      v = Math.max(base, 0) + extra;
      // 若只有条件 +5 且另有基础技，getActiveSkills 会另算；这里取条件峰值
      if (!base) v = extra;
      peakNeed = /拉特兰/.test(d) ? '需其他拉特兰发电' : (/凯尔希/.test(d) ? '需凯尔希中枢' : (/逻各斯/.test(d) ? '需逻各斯训练' : (/作业平台/.test(d) ? '需其他作业平台' : '需条件')));
    } else if (/无人机充能速度\+(\d+(?:\.\d+)?)%/.test(d)) {
      v = +d.match(/无人机充能速度\+(\d+(?:\.\d+)?)%/)[1];
    } else if (typeof s.efficiency === 'number' && s.efficiency > 0) {
      v = s.efficiency;
    }

    if (v > best) {
      best = v;
      kind = 'speed';
    }
  }

  return { score: best, kind: best > 0 ? 'speed' : (kind === 'bias' ? 'bias' : 'none'), peakNeed, note };
}

/** 从训练技能文案解析面向职业（专精特化分组用） */
function getTrainTargetProfessions(skills, { anyMastery = false } = {}) {
  const found = [];
  const reDual = /(先锋|近卫|重装|狙击|术师|医疗|辅助|特种)与(先锋|近卫|重装|狙击|术师|医疗|辅助|特种)干员/;
  const reOne = /(先锋|近卫|重装|狙击|术师|医疗|辅助|特种)干员/;
  for (const s of skills || []) {
    if (s.roomType !== 'TRAINING') continue;
    const d = s.desc || '';
    const hasLv = anyMastery ? /专精技能至[123]级/.test(d) : /专精技能至3级/.test(d);
    if (!hasLv) continue;
    const dual = d.match(reDual);
    if (dual) {
      found.push(dual[1], dual[2]);
      continue;
    }
    const one = d.match(reOne);
    if (one) found.push(one[1]);
    else found.push('通用');
  }
  const uniq = [...new Set(found)];
  uniq.sort((a, b) => PROFESSION_ORDER.indexOf(a) - PROFESSION_ORDER.indexOf(b));
  return uniq.length ? uniq : ['其他'];
}

/** 训练室专精特化等级：1/2/3 → 专一/专二/专三（取技能文案最高档） */
function getTrainMasteryLevel(skills) {
  let maxLv = 0;
  for (const s of skills || []) {
    if (s.roomType !== 'TRAINING') continue;
    const d = s.desc || '';
    for (const m of d.matchAll(/专精技能至(\d)级/g)) {
      maxLv = Math.max(maxLv, +m[1]);
    }
  }
  return maxLv > 0 ? maxLv : 0;
}

function formatTrainMasteryLabel(lv) {
  return ({ 1: '专一', 2: '专二', 3: '专三' })[lv] || (lv ? `专${lv}` : '');
}

// --- 状态 ---
let selectedFacility = null; // { roomType, roomIdx }
let filterRoom = 'ALL';
let filterRarity = 'ALL';
let searchText = '';
let showUnassigned = false;
let isAutoRoomFilter = false; // true=由选中设施触发，false=用户手动点击筛选按钮
let dragCharId = null;
let tooltipTimeout = null;

// 头像 URL 缓存
const avatarCache = {};

// --- 头像获取（优先较新的镜像；onerror 可回退）---
const AVATAR_CDN = [
  (id) => `https://raw.githubusercontent.com/PuppiizSunniiz/Arknight-Images/main/avatars/${id}.png`,
  (id) => `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/avatars/${id}.png`,
];
function getAvatarUrl(charId, mirrorIdx = 0) {
  const key = `${charId}#${mirrorIdx}`;
  if (avatarCache[key]) return avatarCache[key];
  const make = AVATAR_CDN[mirrorIdx] || AVATAR_CDN[0];
  const url = make(charId);
  avatarCache[key] = url;
  return url;
}
/** img onerror：换下一个镜像；都失败则显示占位字 */
function avatarOnErrorAttr(charId) {
  const safe = String(charId).replace(/'/g, '');
  return `onerror="window.__avatarFallback&&window.__avatarFallback(this,'${safe}')"`;
}
window.__avatarFallback = function (img, charId) {
  const idx = parseInt(img.dataset.mirror || '0', 10) + 1;
  if (idx < AVATAR_CDN.length) {
    img.dataset.mirror = String(idx);
    img.src = getAvatarUrl(charId, idx);
    return;
  }
  img.style.display = 'none';
  const wrap = img.parentElement;
  if (wrap && !wrap.querySelector('.avatar-fallback')) {
    const fb = document.createElement('div');
    fb.className = 'avatar-fallback';
    const name = BUILDING_DATA.chars[charId]?.name || '?';
    fb.textContent = name.slice(0, 2);
    wrap.appendChild(fb);
  }
};

// --- Toast 通知 ---
let toastEl = null;
let toastTimer = null;
function showToast(msg, type = 'info', dur = 2000) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = `toast ${type}`;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

// --- 工具函数 ---
function getAssignedRoomLabel(charId) {
  for (const roomType in engine.layout) {
    const rooms = engine.layout[roomType];
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].operators.includes(charId)) {
        const meta = ROOM_META[roomType];
        const label = rooms.length > 1 ? `${meta.name}${i + 1}` : meta.name;
        return { roomType, roomIdx: i, label };
      }
    }
  }
  return null;
}

/** 干员是否已在 lineup 要求的设施类型里（错房间不算完成） */
function isAssignedToHint(charId, syn, name) {
  const loc = getAssignedRoomLabel(charId);
  if (!loc) return false;
  const hint = syn.roomHints?.[name];
  if (!hint) return true;
  return loc.roomType === hint;
}

function getRoomCapacityForDisplay(roomType, level) {
  return engine.getRoomCapacity(roomType, level);
}

// 效率值 -> CSS class
function effClass(eff) {
  if (eff >= 150) return 'eff-high';
  if (eff >= 120) return 'eff-mid';
  if (eff > 100) return 'eff-base';
  return 'eff-low';
}

// ============================================================
// 渲染左侧设施列表
// ============================================================
function renderFacilities() {
  const list = document.getElementById('facilitiesList');
  list.innerHTML = '';

  const power = engine.calcPowerBalance();

  // 定义渲染顺序和分组
  const groups = [
    { label: '指挥', types: ['CONTROL'] },
    { label: '生产', types: ['MANUFACTURE'] },
    { label: '贸易', types: ['TRADING'] },
    { label: '动力', types: ['POWER'] },
    { label: '宿舍', types: ['DORMITORY'] },
    { label: '辅助', types: ['HIRE', 'TRAINING', 'MEETING'] },
  ];

  for (const group of groups) {
    const groupLabel = document.createElement('div');
    groupLabel.className = 'room-group-title';
    groupLabel.textContent = group.label;
    list.appendChild(groupLabel);

    for (const roomType of group.types) {
      const rooms = engine.layout[roomType];
      if (!rooms || rooms.length === 0) continue;

      // 同类设施横向排列
      const row = document.createElement('div');
      row.className = `facility-row row-${Math.min(rooms.length, 5)}`;

      rooms.forEach((room, idx) => {
        const card = createFacilityCard(roomType, idx, room, power);
        row.appendChild(card);
      });

      list.appendChild(row);
    }
  }
}

function createFacilityCard(roomType, roomIdx, room, power) {
  const meta = ROOM_META[roomType];
  const isSelected = selectedFacility &&
    selectedFacility.roomType === roomType &&
    selectedFacility.roomIdx === roomIdx;

  const cap = engine.getRoomCapacity(roomType, room.level);
  const occupied = room.operators.length;
  const effStr = getEfficiencyStr(roomType, roomIdx);

  // 电量信息
  const roomCost = engine.getRoomPowerCost(roomType, room.level);

  // 多个设施时只显示序号，单个不显示
  const rooms = engine.layout[roomType];
  const showIdx = rooms.length > 1;
  const nameLabel = showIdx ? `${meta.name.slice(0, 2)}${roomIdx + 1}` : meta.name;
  
  const productLabel = (roomType === 'MANUFACTURE' || roomType === 'TRADING') && room.product 
    ? `<span class="product-tag">${PRODUCT_MAP[roomType][room.product]}</span>` 
    : '';

  const card = document.createElement('div');
  card.className = `facility-card${isSelected ? ' selected' : ''} room-${roomType}`;
  card.dataset.roomType = roomType;
  card.dataset.roomIdx = roomIdx;

  card.innerHTML = `
    <div class="facility-card-header">
      <div class="facility-type-icon icon-bg-${roomType}">${meta.icon}</div>
      <div class="facility-info">
        <div class="facility-name-row">
          <div class="facility-name">${nameLabel} ${productLabel}</div>
          ${roomType === 'DORMITORY' && occupied
            ? `<button type="button" class="facility-clear-mini" data-clear-dorm="${roomIdx}" title="清空本间宿舍">清空</button>`
            : ''}
        </div>
        <div class="facility-meta">
          <span class="facility-level">Lv.${room.level}</span>
          ${effStr ? `<span class="facility-eff">${effStr}</span>` : ''}
          <span class="facility-cap">${occupied}/${cap}</span>
        </div>
      </div>
    </div>
    <div class="facility-ops-preview" id="preview-${roomType}-${roomIdx}"></div>
  `;

  // 渲染干员预览头像
  const preview = card.querySelector(`#preview-${roomType}-${roomIdx}`);
  for (let i = 0; i < cap; i++) {
    const charId = room.operators[i];
    const slot = document.createElement('div');
    slot.className = `op-avatar-mini${charId ? '' : ' empty'}`;
    if (charId) {
      const char = BUILDING_DATA.chars[charId];
      slot.title = char ? char.name : charId;
      slot.innerHTML = `<img src="${getAvatarUrl(charId)}" alt="${char?.name || ''}" loading="lazy" data-mirror="0" ${avatarOnErrorAttr(charId)}>
        <div class="rarity-dot rarity-bar-${char?.rarity || 1}"></div>`;
    } else {
      slot.textContent = '+';
    }
    preview.appendChild(slot);
  }

  card.addEventListener('click', () => selectFacility(roomType, roomIdx));
  card.querySelector('[data-clear-dorm]')?.addEventListener('click', e => {
    e.stopPropagation();
    clearDormitoryRoom(roomIdx);
  });

  // 拖拽放入
  card.addEventListener('dragover', e => { if (dragCharId) { e.preventDefault(); card.style.borderColor = 'var(--accent)'; } });
  card.addEventListener('dragleave', () => { card.style.borderColor = ''; });
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.style.borderColor = '';
    if (dragCharId) assignOperatorToRoom(dragCharId, roomType, roomIdx);
  });

  return card;
}


/** 效率百分点 → 倍率计数文案（30 → 0.30；signed 时带 +/-） */
function formatEffRate(pct, { signed = true, digits = 2 } = {}) {
  const rate = Number(pct) / 100;
  if (!Number.isFinite(rate)) return '—';
  const body = Math.abs(rate).toFixed(digits);
  if (!signed) return rate < 0 ? `-${body}` : body;
  if (rate > 0) return `+${body}`;
  if (rate < 0) return `-${body}`;
  return body;
}

function getEfficiencyStr(roomType, roomIdx) {
  try {
    if (roomType === 'MANUFACTURE') {
      const r = engine.calcManufacture(roomIdx);
      return r ? formatEffRate(r.efficiency, { signed: false }) : '';
    }
    if (roomType === 'TRADING') {
      const r = engine.calcTrading(roomIdx);
      // 贸易站展示只计加成，不含基底 1
      return r ? formatEffRate((r.efficiency || 100) - 100, { signed: false }) : '';
    }
    if (roomType === 'POWER') {
      const r = engine.calcPower(roomIdx);
      return r ? formatEffRate(r.droneRecharge, { signed: true }) : '';
    }
    if (roomType === 'DORMITORY') {
      const r = engine.calcDormitory(roomIdx);
      return r ? `${r.totalRecovery.toFixed(2)}/h` : '';
    }
    if (roomType === 'CONTROL') {
      const r = engine.calcControl();
      return r ? `-${(r.globalMoodReduction).toFixed(2)}/h` : '';
    }
  } catch (e) {}
  return '';
}

// ============================================================
// 选中设施 -> 渲染详情面板
// ============================================================
function selectFacility(roomType, roomIdx) {
  selectedFacility = { roomType, roomIdx };

  // 自动将干员列表切换到对应技能筛选
  filterRoom = roomType;
  isAutoRoomFilter = true;  // 标记为自动触发，不过滤掉无技能干员
  showUnassigned = false;
  // 更新筛选按钮高亮
  document.querySelectorAll('.filter-btn[data-room]').forEach(b => {
    if (b.dataset.room !== 'UNASSIGNED') {
      b.classList.toggle('active', b.dataset.room === roomType || (roomType && b.dataset.room === 'ALL' && !b.dataset.room));
    }
  });
  // 找到对应按钮并激活
  const matchBtn = document.querySelector(`.filter-btn[data-room="${roomType}"]`);
  document.querySelectorAll('.filter-btn[data-room]').forEach(b => b.classList.remove('active'));
  if (matchBtn) matchBtn.classList.add('active');
  else document.querySelector('.filter-btn[data-room="ALL"]')?.classList.add('active');

  // 更新左侧选中状态
  document.querySelectorAll('.facility-card').forEach(c => c.classList.remove('selected'));
  const targetCard = document.querySelector(`[data-room-type="${roomType}"][data-room-idx="${roomIdx}"]`);
  if (targetCard) targetCard.classList.add('selected');

  renderDetailPanel();
  renderOperators();
}

function renderDetailPanel() {
  if (!selectedFacility) return;
  const { roomType, roomIdx } = selectedFacility;
  const room = engine.layout[roomType][roomIdx];
  if (!room) return;

  document.getElementById('detailPlaceholder').style.display = 'none';
  const detail = document.getElementById('facilityDetail');
  detail.style.display = 'block';

  const meta = ROOM_META[roomType];
  const cap = engine.getRoomCapacity(roomType, room.level);
  const maxLevel = { CONTROL: 5, MANUFACTURE: 3, TRADING: 3, POWER: 3, DORMITORY: 5, HIRE: 3, TRAINING: 3, MEETING: 3 }[roomType] || 3;

  // 计算当前效率数据
  const stats = calcRoomStats(roomType, roomIdx);
  const roomCost = engine.getRoomPowerCost(roomType, room.level);
  const powerBalance = engine.calcPowerBalance();
  const powerOk = powerBalance.balance >= 0;

  // 生成等级按钮
  const levelBtns = Array.from({ length: maxLevel }, (_, i) => {
    const lv = i + 1;
    return `<button class="level-btn${room.level === lv ? ' active' : ''}" data-level="${lv}">Lv.${lv}</button>`;
  }).join('');

  // 生成干员槽位
  const slotHtml = Array.from({ length: cap }, (_, i) => {
    const charId = room.operators[i];
    if (charId) {
      const char = BUILDING_DATA.chars[charId];
      return `
        <div class="op-slot occupied room-${roomType}" data-slot="${i}" data-char="${charId}">
          <img class="op-slot-img" src="${getAvatarUrl(charId)}" alt="${char?.name || ''}" loading="lazy" data-mirror="0" ${avatarOnErrorAttr(charId)}>
          <div class="op-slot-overlay"><div class="op-slot-name">${char?.name || charId}</div></div>
          <div class="op-slot-remove" data-remove="${charId}">×</div>
        </div>`;
    } else {
      return `
        <div class="op-slot empty room-${roomType}" data-slot="${i}"
             ondragover="event.preventDefault();this.classList.add('drop-target')"
             ondragleave="this.classList.remove('drop-target')"
             ondrop="handleSlotDrop(event,'${roomType}',${roomIdx},${i})">
          <span class="slot-empty-icon">+</span>
          <span class="slot-empty-text">拖入干员</span>
        </div>`;
    }
  }).join('');

  // 效率数据卡片
  const statsHtml = renderStatsCards(roomType, stats);

  // 技能buff列表
  const buffHtml = renderBuffList(stats);

  let productSelector = '';
  if (roomType === 'MANUFACTURE' || roomType === 'TRADING') {
    const options = roomType === 'MANUFACTURE' 
      ? [{k:'GOLD', v:'赤金'}, {k:'EXP', v:'经验'}, {k:'ORUNDUM', v:'搓玉'}] 
      : [{k:'GOLD', v:'赤金'}, {k:'ORUNDUM', v:'搓玉'}];
    productSelector = `
      <div class="product-selector">
        <span style="font-size:11px;color:var(--text-muted);margin-right:8px;">产物:</span>
        ${options.map(o => `<button class="product-btn${room.product === o.k ? ' active' : ''}" onclick="window.changeProduct('${roomType}', ${roomIdx}, '${o.k}')">${o.v}</button>`).join('')}
      </div>
    `;
  }

  detail.innerHTML = `
    <div class="facility-detail-header">
      <div class="facility-detail-icon icon-bg-${roomType}">${meta.icon}</div>
      <div class="facility-detail-title">
        <h3>${meta.name}${engine.layout[roomType].length > 1 ? ` ${roomIdx + 1}` : ''}</h3>
        <div class="detail-meta">
          <div class="detail-meta-item">容量 <span>${room.operators.length}/${cap}</span></div>
          ${stats.moodCost !== undefined ? `<div class="detail-meta-item">心情消耗 <span class="${getMoodClass(stats.moodCost)}">${stats.moodCost}/h</span></div>` : ''}
          ${roomCost > 0 ? `<div class="detail-meta-item">耗电 <span style="color:${powerOk ? '#f0d040' : '#f04a4a'}">${roomCost}</span></div>` : ''}
          ${roomType === 'POWER' ? `<div class="detail-meta-item">发电 <span style="color:var(--text-green)">+${[60,130,270][room.level-1]||270}</span></div>` : ''}
        </div>
      </div>
    </div>

    <div class="level-selector" id="levelSelector">
      ${levelBtns}
      ${productSelector}
    </div>

    <div class="slots-section">
      <div class="slots-section-head">
        <div class="slots-section-title">进驻干员 (${room.operators.length}/${cap})</div>
        ${roomType === 'DORMITORY'
          ? `<button type="button" class="room-clear-btn" data-clear-room ${room.operators.filter(Boolean).length ? '' : 'disabled'} title="清空本间宿舍全部干员">一键清空</button>`
          : buildRoomShiftBarHtml(roomType, roomIdx, stats)}
      </div>
      <div class="slots-with-synergy">
        <div class="slots-avatars-row">
          <div class="operator-slots" id="operatorSlots">
            ${slotHtml}
          </div>
          ${(() => {
            const note = getFacilitySlotNote(roomType, roomIdx, stats);
            if (!note) return '';
            return `<aside class="facility-slot-note">
              <div class="facility-slot-note-title">${note.title}</div>
              <div class="facility-slot-note-body">${note.body}</div>
            </aside>`;
          })()}
        </div>
        <div class="detail-synergy-panel" id="detailSynergyPanel"></div>
      </div>
    </div>

    ${room.operators.length > 0 ? `
    <div class="mood-section">
      <div class="slots-section-title" style="margin-top:10px;">心情调整 <span style="font-weight:400;opacity:.7;font-size:11px">右侧 = 当前心情 ÷ 个人消耗/时</span></div>
      <div class="mood-editor-list">
        ${room.operators.map(charId => {
          if (!charId) return '';
          const char = BUILDING_DATA.chars[charId];
          const mood = engine.getOperatorMood(charId);
          const drain = (stats.operatorMoodDrains && stats.operatorMoodDrains[charId] != null)
            ? stats.operatorMoodDrains[charId]
            : (stats.moodCost || 1);
          const hours = drain > 0.001 ? mood / drain : Infinity;
          const hoursText = !isFinite(hours) ? '∞' : (hours >= 100 ? '99+' : hours.toFixed(1));
          return `
            <div class="mood-editor-item">
              <span class="mood-editor-name">${char?.name || charId}</span>
              <input type="range" class="mood-slider" min="0" max="24" step="0.5" value="${mood}"
                     data-char-id="${charId}" data-drain="${drain}"
                     oninput="window.previewMoodHours(this)"
                     onchange="window.updateMood('${charId}', this.value)">
              <span class="mood-editor-val" id="mood-val-${charId}">${mood.toFixed(1)}</span>
              <span class="mood-editor-drain" title="个人心情消耗/时">${drain.toFixed(2)}/h</span>
              <span class="mood-editor-hours" id="mood-hrs-${charId}" title="预计可工作时长">还可 ${hoursText}h</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${statsHtml}

    <div class="divider"></div>

    <div class="buff-list-title">生效技能</div>
    <div class="buff-list" id="buffList">
      ${buffHtml || '<div class="empty-state">当前无干员进驻</div>'}
    </div>

  `;

  // 绑定等级按钮事件
  detail.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lv = parseInt(btn.dataset.level);
      engine.setRoomLevel(roomType, roomIdx, lv);
      renderFacilities();
      renderDetailPanel();
      updateGlobalStats();
    });
  });

  // 绑定移除干员事件
  detail.querySelectorAll('.op-slot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const charId = btn.dataset.remove;
      engine.removeOperator(charId);
      renderFacilities();
      renderDetailPanel();
      renderOperators();
      updateGlobalStats();
      showToast(`已移除 ${BUILDING_DATA.chars[charId]?.name || charId}`, 'info');
    });
  });

  // 绑定干员槽位点击（点击已占用槽位显示提示）
  detail.querySelectorAll('.op-slot.occupied').forEach(slot => {
    slot.addEventListener('click', e => {
      if (e.target.closest('.op-slot-remove')) return;
      const charId = slot.dataset.char;
      const char = BUILDING_DATA.chars[charId];
      showToast(`点击 × 可移除 ${char?.name || charId}`, 'info');
    });
  });

  // 绑定tooltip
  detail.querySelectorAll('.op-slot.occupied').forEach(slot => {
    slot.addEventListener('mouseenter', e => showOpTooltip(e, slot.dataset.char, roomType));
    slot.addEventListener('mouseleave', hideTooltip);
    slot.addEventListener('mousemove', e => moveTooltip(e));
  });

  renderDetailSynergies();
  bindRoomShiftBarEvents(detail);
  detail.querySelector('[data-clear-room]')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!selectedFacility || selectedFacility.roomType !== 'DORMITORY') return;
    clearDormitoryRoom(selectedFacility.roomIdx);
  });
}

/** 清空指定宿舍全部干员 */
function clearDormitoryRoom(roomIdx) {
  const room = engine.layout.DORMITORY?.[roomIdx];
  if (!room) return;
  const ids = (room.operators || []).filter(Boolean).slice();
  if (!ids.length) {
    showToast(`宿舍${roomIdx + 1}本来就是空的`, 'info');
    return;
  }
  for (const id of ids) engine.removeOperator(id);
  autoSave();
  showToast(`宿舍${roomIdx + 1}：已清空 ${ids.length} 人`, 'success');
  renderFacilities();
  if (selectedFacility?.roomType === 'DORMITORY' && selectedFacility.roomIdx === roomIdx) {
    renderDetailPanel();
  }
  renderOperators();
  updateGlobalStats();
}

// 全局暴露修改心情的函数
window.previewMoodHours = function(slider) {
  const charId = slider.dataset.charId;
  const drain = parseFloat(slider.dataset.drain) || 1;
  const mood = parseFloat(slider.value);
  const valEl = document.getElementById('mood-val-' + charId);
  const hrsEl = document.getElementById('mood-hrs-' + charId);
  if (valEl) valEl.innerText = mood.toFixed(1);
  if (hrsEl) {
    const hours = drain > 0.001 ? mood / drain : Infinity;
    const hoursText = !isFinite(hours) ? '∞' : (hours >= 100 ? '99+' : hours.toFixed(1));
    hrsEl.innerText = `还可 ${hoursText}h`;
  }
};

window.updateMood = function(charId, val) {
  engine.setOperatorMood(charId, val);
  // 心情可能影响技能效果（如夕），因此需要重新渲染详情
  if (selectedFacility) {
    renderDetailPanel();
  }
  updateGlobalStats(); // 含 autoSave
};

window.changeProduct = function(type, idx, prod) {
  engine.setRoomProduct(type, idx, prod);
  renderFacilities();
  if (selectedFacility) renderDetailPanel();
  // 制造站产物变化时，干员列表按产物重排
  if (type === 'MANUFACTURE' && selectedFacility?.roomType === 'MANUFACTURE') {
    renderOperators();
  }
  updateGlobalStats();
};

function getMoodClass(moodCost) {
  if (moodCost <= 0.5) return 'eff-high';
  if (moodCost <= 0.8) return 'eff-mid';
  return 'eff-low';
}

function calcRoomStats(roomType, roomIdx) {
  switch (roomType) {
    case 'MANUFACTURE': return engine.calcManufacture(roomIdx) || {};
    case 'TRADING':     return engine.calcTrading(roomIdx) || {};
    case 'POWER':       return engine.calcPower(roomIdx) || {};
    case 'DORMITORY':   return engine.calcDormitory(roomIdx) || {};
    case 'CONTROL':     return engine.calcControl() || {};
    case 'HIRE':        return engine.calcHire() || {};
    case 'MEETING':     return engine.calcMeeting() || {};
    case 'TRAINING':    return engine.calcTraining() || {};
    default:            return {};
  }
}

/** 本设施说明：放进驻干员头像旁（不放右侧干员列表） */
function getFacilitySlotNote(roomType, roomIdx, stats) {
  if (roomType === 'MANUFACTURE') {
    const room = engine.layout.MANUFACTURE[roomIdx];
    const product = room?.product || 'GOLD';
    const productName = PRODUCT_MAP.MANUFACTURE[product] || product;
    const food = engine.getMonsterCuisineCount();
    const powers = engine.getEffectivePowerCount?.() ?? (engine.layout.POWER?.length || 0);
    const trades = engine.layout.TRADING?.length || 0;
    return {
      title: `制造站 · 当前产物：${productName}`,
      body: `右侧干员库数字均为 <span class="meet-note-total">满配峰值</span>（玛露西尔按森西 Lv5 料理、清流按 3 贸易、温蒂/森蚺按 3 发电等）；有搭配组也按满配估，未配齐会更低。<br>
        <span class="facility-slot-note-live">当前：魔物料理 <b>${food}</b>（玛露西尔满配参考 5）· 有效发电 <b>${powers}</b>· 贸易站 <b>${trades}</b></span>`
    };
  }
  if (roomType === 'MEETING') {
    const intel = engine.getIntelReserveCount();
    const food = engine.getMonsterCuisineCount();
    return {
      title: '会客室 · 右侧效率一律按精二计算',
      body: `卡片分 = <span class="meet-note-base">本体</span>（隐藏进驻）+ <span class="meet-note-skill">技能</span>。例：陈/伺夜 = <span class="meet-note-base">本体26</span>+<span class="meet-note-skill">技能25</span> = <span class="meet-note-total">+51%</span>。<br>
        <span class="meet-note-row"><span class="meet-rarity r6">6★精二</span> 本体 <b>26%</b>（星5+精二16+非涣散5）</span>
        <span class="meet-note-row"><span class="meet-rarity r5">5★精二</span> 本体 <b>25%</b>（星4+精二16+非涣散5）→ 技能25 时合计 <span class="meet-note-total">+50%</span></span>
        <span class="meet-note-row"><span class="meet-rarity r4">4★精二</span> 本体 <b>23%</b>（星2+精二16+非涣散5）</span>
        未精二自行减：精一 −8%，精0 −16%。跃跃/响石默认按「线索交流中」计技能。<br>
        <span class="facility-slot-note-live">当前基建：情报储备 <b>${intel}</b>（双月技能 ${5 + intel * 5}%）· 魔物料理 <b>${food}</b>（莱欧斯额外 +${food * 2}%）</span>`
    };
  }
  if (roomType === 'CONTROL') {
    const n = stats?.operators?.length || 0;
    const globalR = stats?.globalMoodReduction ?? Math.min(n, 5) * 0.05;
    return {
      title: '中枢 · 心情减免两类',
      body: `<b>全局减免</b>：中枢里任意干员都算，人数×0.05，5 人吃满（当前 −${globalR.toFixed(2)}/h）。作用于全基建。<br>
        <b>本中枢再减</b>：只有带「彩虹小队 / 异格者」等技能的干员才叠加；普通人第五位不提供本中枢技能减免。永动阵容凑齐后本中枢消耗可为 0。`
    };
  }
  if (roomType === 'HIRE') {
    const total = stats?.recruitSlots ?? engine.getRecruitSlotCount();
    const extra = stats?.extraRecruitSlots ?? engine.getExtraRecruitSlots();
    const init = stats?.initialRecruitSlots ?? 2;
    const dormLv = stats?.dormLevelSum ?? engine.getDormLevelSum();
    return {
      title: '办公室 · 右侧均为满配峰值',
      body: `公开招募 <span class="meet-note-total">初始 ${init} 栏</span>；<span class="meet-note-skill">只跟办公室等级挂钩</span>（与会客室等级无关）：Lv1/2/3 总栏位 <b>2/3/4</b>，额外位 <b>0/1/2</b>。<br>
        乌有/月禾：联络速度固定；额外位每档 +5% <b>会客线索</b>（满配额外2→会客+10%）。锡人：+5%+宿舍等级合计×2%。<br>
        <span class="facility-slot-note-live">当前：总栏位 <b>${total}</b> · 额外 <b>${extra}</b>（初始${init}不含）· 宿舍等级合计 <b>${dormLv}</b>（锡人精二约 +${5 + dormLv * 2}%）</span>`
    };
  }
  if (roomType === 'TRADING') {
    return {
      title: '贸易站 · 右侧均为满配峰值',
      body: `获取速度按满配估（宿舍等级、同站人数、人间烟火等）。投资/违约类不抬速度，另组列出。条件不够时实际更低。`
    };
  }
  if (roomType === 'POWER') {
    return {
      title: '发电站 · 右侧均为满配峰值',
      body: `充能速度按满配估（工时满额、无人机上限等）。承曦「晨曦」不加充能、只加有效发电站数，归在机制组。`
    };
  }
  if (roomType === 'TRADING') {
    const goldNote = buildGoldLineSlotNote(roomIdx, stats);
    if (goldNote) return goldNote;
  }
  return null;
}

/** 鸿雪/图耶/绮良：顶配核对（加成不对时看这里） */
function buildGoldLineSlotNote(roomIdx, stats) {
  const room = engine.layout.TRADING?.[roomIdx];
  if (!room) return null;
  const ops = (room.operators || []).filter(Boolean);
  const names = ops.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
  const hasAny = ['鸿雪', '图耶', '绮良'].some(n => names.includes(n));
  if (!hasAny) return null;

  const buffEffects = stats?.buffEffects || engine.collectBuffEffects('TRADING', ops);
  const g = engine.calcGoldLineTeam(ops, buffEffects);
  const skillSum = (g.hEff || 0) + (g.tEff || 0) + (g.kEff || 0);
  const hasAll = ['绮良', '图耶', '鸿雪'].every(n => names.includes(n));
  const orderStr = names.filter(n => ['绮良', '图耶', '鸿雪'].includes(n)).join('→') || '—';
  const topSkill = 110; // 双赤金+4杜林+三人精二
  const issues = [];
  if (!hasAll) issues.push('三人未齐');
  if (hasAll && !g.orderOk) issues.push('站序非顶配（应 绮良→图耶→鸿雪）');
  if (g.durinLines < 4) issues.push(`杜林线仅 ${g.durinLines}/4`);
  if (g.manuGold < 2) issues.push(`制造赤金仅 ${g.manuGold}（顶配按 2）`);
  if (hasAll && g.orderOk && g.durinLines >= 4 && g.manuGold >= 2 && skillSum < topSkill - 0.5) {
    issues.push('技能未到顶配，检查是否精二/技能档');
  }

  const issueHtml = issues.length
    ? `<br><span class="facility-slot-note-warn">⚠ 加成可能不对：${issues.join('；')}。点右侧「一键·当前站」可按顶配重排</span>`
    : (hasAll
      ? `<br><span class="facility-slot-note-live">✓ 站序与条件正常；顶配技能合计约 ${topSkill}%（界面效率不含基底1）</span>`
      : '');

  return {
    title: '赤金线 · 顶配核对',
    body: `站序（左→右）：<b>${orderStr}</b>　一键固定 <b>绮良→图耶→鸿雪</b><br>
      当前：造赤金 <b>${g.manuGold}</b> · 杜林线 <b>${g.durinLines}</b>/4 · 绮良加 <b>${g.kiraraExtra}</b>
      · 技能 <b>鸿雪${g.hEff}+图耶${g.tEff}+绮良${g.kEff}=${skillSum}</b>${g.tGetsKirara || g.hGetsKirara ? '' : (g.kiraraExtra ? '（有人未吃到绮良加线）' : '')}
      <br>顶配参考：双赤金+4杜林 → <b>40+65+5=110</b>（+人数/中枢另计；绮良不加杜林线）
      ${issueHtml}`
  };
}

function renderStatsCards(roomType, stats) {
  const rows = [];
  const buffEffects = stats.buffEffects || [];

  // --- 心情消耗行 ---
  if (stats.moodCost !== undefined) {
    const drains = stats.operatorMoodDrains || {};
    const drainEntries = Object.entries(drains);
    const moodChips = [];
    if (drainEntries.length > 1 && stats.moodCostMin != null && stats.moodCostMax != null
        && Math.abs(stats.moodCostMax - stats.moodCostMin) > 0.001) {
      moodChips.push(`<span class="ak-chip chip-neutral" title="各干员消耗不同（有人只加自身）">${stats.moodCostMin.toFixed(2)}~${stats.moodCostMax.toFixed(2)}</span>`);
    }
    for (const { charId, skill } of buffEffects) {
      const kind = engine.classifyMoodSkill(skill);
      if (kind !== 'self' && kind !== 'all') continue;
      const mc = skill.moodCost;
      if (!mc) continue;
      const who = BUILDING_DATA.chars[charId]?.name || '';
      const tag = kind === 'self' ? '己' : '全';
      moodChips.push(`<span class="ak-chip ${mc < 0 ? 'chip-good' : 'chip-bad'}" title="${who}（${kind === 'self' ? '仅自身' : '全体'}）">${mc > 0 ? '+' : ''}${mc}<sup>${tag}</sup></span>`);
    }
    const finalMood = stats.moodCost;
    const moodCls = finalMood <= 0.5 ? 'ak-val-green' : finalMood <= 0.8 ? 'ak-val-yellow' : 'ak-val-red';
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">心情消耗/时</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-base" title="基础1 − 中枢 − 人数">基</span>
          ${moodChips.join('')}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ${moodCls}" title="取进驻中最高消耗">${finalMood.toFixed(2)}${drainEntries.length > 1 ? '↑' : ''}</span>
        </span>
      </div>`);
  }

  // --- 效率行（制造/贸易）：用 0.01 倍率计数；仅制造站显示基底 1 ---
  if (roomType === 'MANUFACTURE' || roomType === 'TRADING') {
    const eff = stats.efficiency || 100;
    const label = roomType === 'MANUFACTURE' ? '生产力' : '订单效率';
    const baseOps = stats.operators?.filter(Boolean).length || 0;
    const showBase1 = roomType === 'MANUFACTURE';

    const effChips = [];
    if (showBase1) {
      effChips.push(`<span class="ak-chip chip-base" title="设施基础效率">1</span>`);
    }
    if (baseOps > 0) {
      effChips.push(`<span class="ak-chip chip-neutral" title="进驻人数：每人 +0.01">+${(baseOps * 0.01).toFixed(2)}<sup>人</sup></span>`);
    }
    for (const { charId, skill } of buffEffects) {
      if (skill._isOrderValueBonus) continue;
      const e = skill.actualEfficiency !== undefined ? skill.actualEfficiency : skill.efficiency;
      if (e === undefined || e === null || e === 0) continue;
      const charName = BUILDING_DATA.chars[charId]?.name || '';
      const isGlobal = skill.isGlobal;
      const isGood = e > 0;
      const chipCls = isGlobal ? 'chip-global' : (isGood ? 'chip-good' : 'chip-bad');
      const title = `${charName}: ${skill.name || ''}`;
      const label2 = isGlobal ? `<sup>全</sup>` : '';
      effChips.push(`<span class="ak-chip ${chipCls}" title="${title}">${formatEffRate(e)}${label2}</span>`);
    }

    const effCls = eff >= 200 ? 'ak-val-green' : eff >= 140 ? 'ak-val-yellow' : 'ak-val-white';
    // 仅制造站合计含基底 1；其它只显示加成合计
    const effShowPct = showBase1 ? eff : (eff - 100);
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">${label}</span>
        <span class="ak-stat-chain">
          ${effChips.join('')}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ${effCls}" title="${showBase1 ? '1 + 人数×0.01 + 技能' : '人数×0.01 + 技能（不含基底1）'}">${formatEffRate(effShowPct, { signed: false })}</span>
        </span>
      </div>`);

    // 贸易站：龙门币产速等效（展示不含基底 1）
    if (roomType === 'TRADING' && stats.lmdEquivalentEff != null && stats.lmdValueMult > 1.001) {
      rows.push(`
        <div class="ak-stat-row">
          <span class="ak-stat-label">龙门币等效</span>
          <span class="ak-stat-chain">
            <span class="ak-chip chip-neutral" title="订单获取速度加成">${formatEffRate(eff - 100, { signed: false })}</span>
            <span class="ak-chip chip-good" title="相对本级基础订单的单均龙门币倍率">×${stats.lmdValueMult.toFixed(2)}</span>
            <span class="ak-chain-arrow">=</span>
            <span class="ak-val ak-val-green" title="龙门币产速等效加成（不含基底1）">${formatEffRate(stats.lmdEquivalentEff - 100, { signed: false })}</span>
          </span>
        </div>`);
    }

    // 额外资料行
    if (roomType === 'MANUFACTURE') {
      const product = stats.product || 'GOLD';
      const capBonus = stats.capacity - engine.getRoomCapacity('MANUFACTURE', stats.level);
      if (capBonus > 0) {
        rows.push(`
          <div class="ak-stat-row">
            <span class="ak-stat-label">仓库容量</span>
            <span class="ak-stat-chain">
              <span class="ak-chip chip-base">${engine.getRoomCapacity('MANUFACTURE', stats.level)}</span>
              <span class="ak-chip chip-good">+${capBonus}</span>
              <span class="ak-chain-arrow">=</span>
              <span class="ak-val ak-val-white">${stats.capacity}</span>
            </span>
          </div>`);
      }
    }
    if (roomType === 'TRADING' && stats.orderLimit) {
      const baseOL = [6, 8, 10][stats.level - 1] || 10;
      const olBonus = stats.orderLimit - baseOL;
      rows.push(`
        <div class="ak-stat-row">
          <span class="ak-stat-label">订单上限</span>
          <span class="ak-stat-chain">
            <span class="ak-chip chip-base">${baseOL}</span>
            ${olBonus !== 0 ? `<span class="ak-chip ${olBonus > 0 ? 'chip-good' : 'chip-bad'}">${olBonus > 0 ? '+' : ''}${olBonus}</span>` : ''}
            <span class="ak-chain-arrow">=</span>
            <span class="ak-val ak-val-white">${stats.orderLimit}</span>
          </span>
        </div>`);
    }
    // 赤金订单 2/3/4 金比例（随贸易站等级与高品质技能变化）
    if (roomType === 'TRADING' && (stats.product || 'GOLD') === 'GOLD' && stats.goldOrderDist) {
      const d = stats.goldOrderDist;
      const pct = (n) => `${Math.round((d[n] || 0) * 100)}%`;
      const avg = stats.goldOrderAvgLmd != null ? Math.round(stats.goldOrderAvgLmd) : null;
      const tierLabel = {
        none: '基础', alpha: 'α峰值', alpha2: 'αα叠加', beta: 'β峰值', force2: '固定2金'
      }[d.tier] || d.tier;
      rows.push(`
        <div class="ak-stat-row">
          <span class="ak-stat-label">赤金订单</span>
          <span class="ak-stat-chain">
            <span class="ak-chip chip-neutral" title="2金订单">2金 ${pct(2)}</span>
            <span class="ak-chip chip-neutral" title="3金订单">3金 ${pct(3)}</span>
            <span class="ak-chip chip-good" title="4金订单">4金 ${pct(4)}</span>
            <span class="ak-chip chip-global" title="分布档位">${tierLabel}</span>
            ${avg != null ? `<span class="ak-val ak-val-white" title="期望龙门币/单">~${avg}</span>` : ''}
          </span>
        </div>`);
    }
  } else if (roomType === 'DORMITORY') {
    const base = stats.baseRecovery || 0;
    const bonus = stats.groupBonus || 0;
    const total = stats.totalRecovery || 0;
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">心情恢复/时</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-base">${base.toFixed(2)}</span>
          ${bonus > 0 ? `<span class="ak-chip chip-good">+${bonus.toFixed(2)}</span>` : ''}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-green">${total.toFixed(2)}</span>
        </span>
      </div>`);
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">水上乐园上限</span>
        <span class="ak-stat-chain">
          <span class="ak-val ak-val-white">${stats.comfortMax || 0}</span>
        </span>
      </div>`);
  } else if (roomType === 'POWER') {
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">无人机充能速度</span>
        <span class="ak-stat-chain">
          ${stats.droneRecharge > 0 ? `<span class="ak-chip chip-good">${formatEffRate(stats.droneRecharge)}</span>` : '<span class="ak-chip chip-neutral">—</span>'}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-green" title="仅技能加成，不含基底1">${formatEffRate(stats.droneRecharge || 0, { signed: false })}</span>
        </span>
      </div>`);
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">电力输出</span>
        <span class="ak-stat-chain">
          <span class="ak-val ak-val-yellow">+${stats.powerOutput || 0}</span>
        </span>
      </div>`);
  } else if (roomType === 'CONTROL') {
    const globalR = stats.globalMoodReduction || 0;
    const localSkillR = (buffEffects || [])
      .reduce((s, { skill }) => s + (typeof skill._moodReduce === 'number' ? skill._moodReduce : 0), 0);
    const localCost = stats.moodCost != null ? stats.moodCost : 1;
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">全局心情减免</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-base" title="中枢任意干员人数×0.05，5人吃满">人数×0.05</span>
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-green" title="作用于全基建各设施基础消耗">-${globalR.toFixed(2)}/h${(stats.operators?.length || 0) >= 5 ? '（已满）' : ''}</span>
        </span>
      </div>`);
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">本中枢消耗</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-base" title="基础1.0 − 全局人数减免">基</span>
          ${localSkillR > 0 ? `<span class="ak-chip chip-good" title="仅彩虹/异格等技能持有者提供">技能-${localSkillR.toFixed(2)}</span>` : ''}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ${localCost <= 0 ? 'ak-val-green' : 'ak-val-yellow'}" title="本中枢进驻干员实际心情消耗/时">${localCost.toFixed(2)}/h${localCost <= 0 ? '（永动）' : ''}</span>
        </span>
      </div>`);
  } else if (roomType === 'TRAINING') {
    const trainBonus = (stats.trainSpeed || 100) - 100;
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">训练速度</span>
        <span class="ak-stat-chain">
          ${buffEffects.filter(({skill:s}) => (s.actualEfficiency||0) > 0).map(({charId, skill:s}) => 
            `<span class="ak-chip chip-good" title="${BUILDING_DATA.chars[charId]?.name}">${formatEffRate(s.actualEfficiency)}</span>`).join('') || '<span class="ak-chip chip-neutral">—</span>'}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-yellow" title="仅加成，不含基底1">${formatEffRate(trainBonus, { signed: false })}</span>
        </span>
      </div>`);
  } else if (roomType === 'MEETING') {
    const levelB = stats.meetingLevelBonus || 0;
    const opBases = stats.meetingOpBases || [];
    const clueBonus = (stats.clueSpeed || 100) - 100;
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">线索速度</span>
        <span class="ak-stat-chain">
          ${levelB ? `<span class="ak-chip chip-neutral" title="会客室等级">${formatEffRate(levelB)}<sup>Lv</sup></span>` : ''}
          ${opBases.map(o =>
            `<span class="ak-chip chip-neutral" title="${o.name}：稀有度${formatEffRate(o.rarityB)} 精${o.elite}${formatEffRate(o.eliteB)} 非涣散${formatEffRate(o.focusB)}">${formatEffRate(o.total)}<sup>${o.rarity}★</sup></span>`
          ).join('')}
          ${buffEffects.filter(({skill:s}) => (s.actualEfficiency||0) > 0).map(({charId, skill:s}) =>
            `<span class="ak-chip chip-good" title="${BUILDING_DATA.chars[charId]?.name} ${s.name}">${formatEffRate(s.actualEfficiency)}</span>`
          ).join('')}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-yellow" title="仅加成，不含基底1">${formatEffRate(clueBonus, { signed: false })}</span>
        </span>
      </div>`);
  } else if (roomType === 'HIRE') {
    const baseSpd = stats.baseRefreshSpeed != null
      ? stats.baseRefreshSpeed
      : ([10, 20, 30][(stats.level || 3) - 1] || 30);
    const totalSlots = stats.recruitSlots ?? engine.getRecruitSlotCount();
    const extraSlots = stats.extraRecruitSlots ?? engine.getExtraRecruitSlots();
    const initSlots = stats.initialRecruitSlots ?? 2;
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">招募栏位</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-neutral" title="公开招募初始栏位">初始 ${initSlots}</span>
          <span class="ak-chip chip-good" title="办公室升级解锁（乌有/月禾/骋风等只吃这个）">额外 ${extraSlots}</span>
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-yellow">总 ${totalSlots}</span>
        </span>
      </div>`);
    rows.push(`
      <div class="ak-stat-row">
        <span class="ak-stat-label">联络速度</span>
        <span class="ak-stat-chain">
          <span class="ak-chip chip-neutral" title="设施等级加成">${formatEffRate(baseSpd)}<sup>Lv</sup></span>
          ${buffEffects.filter(({skill:s}) => (s.actualEfficiency || s.efficiency || 0) > 0).map(({charId, skill:s}) => {
            const v = s.actualEfficiency || s.efficiency;
            return `<span class="ak-chip chip-good" title="${BUILDING_DATA.chars[charId]?.name}">${formatEffRate(v)}</span>`;
          }).join('')}
          <span class="ak-chain-arrow">=</span>
          <span class="ak-val ak-val-yellow">${formatEffRate(stats.refreshSpeed || 0, { signed: false })}</span>
        </span>
      </div>`);
  }

  if (!rows.length) return '';
  return `<div class="ak-stats-panel">${rows.join('')}</div>`;
}

function renderBuffList(stats) {
  const buffs = stats.buffEffects || [];
  if (!buffs.length) return '';
  return buffs.map(({ charId, skill }) => {
    const char = BUILDING_DATA.chars[charId];
    if (!char) return '';
    const mismatch = !!skill._productMismatch;
    return `
      <div class="buff-item${mismatch ? ' buff-item-off' : ''}">
        <div class="buff-item-avatar">
          <img src="${getAvatarUrl(charId)}" alt="${char.name}" loading="lazy" data-mirror="0" ${avatarOnErrorAttr(charId)}>
        </div>
        <div class="buff-item-info">
          <div class="buff-item-op">${char.name}</div>
          <div class="buff-item-skill">${skill.name || '基建技能'}${mismatch ? '<span class="buff-off-tag">不生效</span>' : ''}</div>
          <div class="buff-item-desc">${skill.desc || ''}</div>
        </div>
        <div class="buff-item-value">${formatBuffValue(skill)}</div>
      </div>`;
  }).join('');
}

function formatBuffValue(skill) {
  // 中枢彩虹/异格：本中枢心情减免（不是效率%）
  if (typeof skill._moodReduce === 'number' && skill._moodReduce !== 0) {
    const v = Math.round(skill._moodReduce * 100) / 100;
    return `<span style="color:var(--text-green)" title="仅降低本中枢进驻干员心情消耗">-${v}/h</span>`;
  }
  // 情报储备 / 乌萨斯特饮等机制技
  if (skill.buffId === 'control_mp_bd[000]' || skill.buffId === 'control_mp_bd[010]') {
    return '<span style="color:var(--accent);font-size:11px">机制</span>';
  }

  // 产物不符：明确提示不生效（勿显示原始 efficiency）
  if (skill._productMismatch) {
    const need = { GOLD: '赤金', EXP: '经验', ORUNDUM: '搓玉' }[skill._productNeed] || '对应产物';
    return `<span class="buff-off-value" title="当前制造产物不匹配，需${need}">不生效</span>`;
  }

  // 优先使用动态计算后的实际生效数值
  let eff = skill.actualEfficiency !== undefined ? skill.actualEfficiency : skill.efficiency;

  if (eff === undefined || eff === null) return '<span style="color:var(--text-muted)">特殊</span>';
  if (eff === 0) {
    // 明确写了 actualEfficiency=0 的机制/未生效，不再显示误导性的 0%
    return '<span style="color:var(--text-muted);font-size:11px">—</span>';
  }

  const roomType = skill.roomType;
  eff = Math.round(eff * 10) / 10;
  const sign = eff > 0 ? '+' : '';

  let valStr = '';
  if (roomType === 'DORMITORY') {
    valStr = `<span style="color:var(--text-green)">${sign}${eff}/h</span>`;
  } else {
    valStr = formatEffRate(eff);
  }

  if (skill.isGlobal) {
    return `<span style="font-size:10px;background:var(--accent);color:#000;padding:2px 4px;border-radius:4px;margin-right:6px">全局</span>${valStr}`;
  }
  return valStr;
}

const SYNERGY_LIST = [
  // --- 多级跨房间体系 ---
  {
    name: '迷宫饭核心 (玛露西尔)',
    core: ['玛露西尔'],
    partners: ['森西'],
    tips: '玛露西尔进制造；森西进宿舍叠魔物料理（一键会塞空宿舍，建议 Lv5）。',
    roomHints: {
      '玛露西尔': 'MANUFACTURE',
      '森西': 'DORMITORY',
    },
    supportNotes: [
      { name: '森西', need: '宿舍', text: '精二食堂：宿舍每级+1魔物料理；一键优先空宿舍' },
    ],
  },
  {
    name: '迷宫饭小队 (森西)',
    core: ['森西'],
    partners: ['莱欧斯', '齐尔查克']
  },
  {
    name: '对陆接洽 (深巡)',
    core: ['深巡'],
    // 乌尔比安只需「在基建内」，一键不塞宿舍
    partners: [],
    tips: '深巡进贸易站。乌尔比安只需在基建内任意岗位（不含副手）即可触发额外效率——一键不自动布置，请自行安排。',
    supportNotes: [
      { name: '乌尔比安', need: '基建内即可', text: '不必进宿舍；在岗即可给深巡额外效率' },
    ],
  },
  {
    name: '深海猎人核心 (乌尔比安/歌蕾蒂娅)',
    core: ['乌尔比安', '歌蕾蒂娅'],
    partners: ['斯卡蒂', '幽灵鲨', '归溟幽灵鲨', '安哲拉'],
    tips: '歌蕾蒂娅技能要求进驻中枢；深海猎人在宿舍外工作才吃满集群加成。一键不把人塞进宿舍凑数。',
    roomHints: {
      '歌蕾蒂娅': 'CONTROL',
      '乌尔比安': 'TRAINING',
    },
    supportNotes: [
      { name: '歌蕾蒂娅', need: '中枢', text: '集群狩猎等技能须进驻中枢' },
      { name: '乌尔比安', need: '训练室', text: '协助位吃基建内深海猎人数' },
    ],
  },
  {
    name: '宇宙模型 (迷迭香)',
    core: ['迷迭香'],
    partners: ['絮雨']
  },
  {
    name: '感知信息体系 (絮雨)',
    core: ['絮雨'],
    partners: ['爱丽丝', '夕', '车尔尼']
  },
  {
    name: '赤金生产线 (鸿雪/图耶/绮良)',
    core: ['鸿雪', '图耶', '绮良'],
    // 一键只布置当前贸易站，并按顶配站序「绮良→图耶→鸿雪」重排
    partners: ['绮良', '图耶', '鸿雪'],
    singleRoom: true,
    slotOrder: ['绮良', '图耶', '鸿雪'],
    lineup: [
      { role: '1号位', pick: ['绮良'], note: '顶配最左：加线只认制造赤金' },
      { role: '2号位', pick: ['图耶'], note: '须排在绮良右侧才能吃加线' },
      { role: '3号位', pick: ['鸿雪'], note: '须排在图耶右侧才吃满绮良加线' },
    ],
    tips: '一键按顶配站序「绮良→图耶→鸿雪」排布。杜林族自行放任意设施（一键不塞宿舍）。加成不对时看进驻旁核对提示。',
    roomHints: {
      '鸿雪': 'TRADING',
      '图耶': 'TRADING',
      '绮良': 'TRADING',
    },
    supportNotes: [
      { name: '杜林族', need: '任意设施×4', text: '杜林/桃金娘/褐果/至简/特克诺（+鸿雪），最多计4；一键不自动进宿舍' },
      {
        name: '顶配核对',
        need: '技能≈110%',
        text: '双赤金制造+4杜林精二：鸿雪40+图耶65+绮良5=110（界面效率不含基底1；+人数/中枢另计）。偏低常见原因：站序不是绮良→图耶→鸿雪、杜林未满、制造非赤金、缺人',
      },
    ],
  },
  {
    // 巫恋清零他人效率并按人数吸血；高品质抬4金权重；龙舌兰对4金加龙门币
    // 第三人高品质β互相等价、不叠——一键只填当前贸易站，且β位只上1人
    name: '巫恋高品质 (龙舌兰)',
    core: ['巫恋', '龙舌兰'],
    partners: ['巫恋', '龙舌兰', '卡夫卡', '柏喙', '折光', '明椒'],
    singleRoom: true, // 不扩散到其他贸易站
    lineup: [
      { role: '核心·低语', pick: ['巫恋'], note: '不可替换' },
      { role: '核心·投资', pick: ['龙舌兰'], note: '不可替换' },
      {
        role: '高品质·β',
        pick: ['卡夫卡', '柏喙', '折光', '明椒'],
        note: '等价替换，队伍只需1人（β不叠）'
      },
    ],
    tips: 'β位：卡夫卡 ≈ 柏喙 ≈ 折光 ≈ 明椒（上位等价，只带1个）。仅α（贝娜/渡桥等）为下位替补，弱于β。一键只布置当前选中的贸易站。',
    roomHints: {
      '巫恋': 'TRADING',
      '龙舌兰': 'TRADING',
      '卡夫卡': 'TRADING',
      '柏喙': 'TRADING',
      '折光': 'TRADING',
      '明椒': 'TRADING',
    }
  },
  {
    // 但书「裸核」：自身几乎无获取速度 → 另两格要顶满效率
    // 单人≈40%：只有空弦（宿舍满级×2%=40%）、吉星（同站另2人×20%=40%）这类一人贡献
    // 双人合计≈80%：①伺夜+贝洛内 ②蕾缪安+本体能天使（相伴不认新约能天使）
    // 勿把能天使35%/德克萨斯写成「单人40」；勿与巫恋高品质同队
    name: '但书违约 (伺夜+贝洛内)',
    core: ['但书', '伺夜', '贝洛内'],
    partners: ['但书', '伺夜', '贝洛内', '空弦', '吉星', '蕾缪安', '能天使'],
    singleRoom: true,
    lineup: [
      { role: '核心·违约', pick: ['但书'], note: '不可替换（合同法+索赔）' },
      {
        role: '单人效率·≈40%',
        pick: ['空弦', '吉星'],
        note: '一人贡献≈40%：空弦=宿舍满级×2%；吉星=同站另2人×20%。能天使只有35%，不算这一档',
        skipDeploy: true,
      },
      {
        role: '双人效率·合计≈80%',
        pick: ['伺夜', '贝洛内'],
        pair: true,
        fill: 'all',
        note: '须两人同站：伺夜满会客≈40% + 贝洛内有伺夜≈40%，占满剩余两格',
      },
      {
        role: '双人效率·合计≈80%',
        pick: ['蕾缪安', '能天使'],
        pair: true,
        note: '须两人同站：蕾缪安「相伴」只认本体能天使（新约/异格能天使不触发）；合计≈80%',
        skipDeploy: true,
      },
    ],
    tips: '但书几乎不抬获取速度，只抬违约单均 → 另两格要顶满。单人≈40%只有空弦/吉星这类；双人≈80%是整组：伺夜+贝洛内，或蕾缪安+本体能天使（异格能天使不行）。勿把能天使35%、德克萨斯拆成「单人40」。勿与巫恋/龙舌兰/高品质同队；U-Official、佩佩、可露希尔会废掉索赔。一键默认伺夜+贝洛内（仅当前站）。',
    roomHints: {
      '但书': 'TRADING',
      '伺夜': 'TRADING',
      '贝洛内': 'TRADING',
      '空弦': 'TRADING',
      '吉星': 'TRADING',
      '蕾缪安': 'TRADING',
      '能天使': 'TRADING',
    },
    supportNotes: [
      { name: '八幡海铃', need: '中枢', text: '「家族认可」须进驻中枢；只加成有叙拉古干员的贸易站' },
    ],
  },
  {
    name: '叙拉古家族 (伺夜)',
    core: ['伺夜'],
    // 贝洛内跟伺夜进贸易；八幡海铃必须中枢，一键不塞宿舍——策略下提示
    partners: ['贝洛内'],
    tips: '贸易站：伺夜 + 贝洛内。八幡海铃「家族认可」必须进驻中枢才给全贸易站叙拉古 +5%/人——一键不自动布置，请手动放中枢。',
    roomHints: {
      '贝洛内': 'TRADING',
    },
    supportNotes: [
      { name: '八幡海铃', need: '中枢', text: '须进驻中枢；只对有叙拉古干员的贸易站生效' },
    ],
  },
  {
    name: '格拉斯哥帮 (维娜)',
    core: ['维娜·维多利亚'],
    partners: ['摩根', '推进之王'],
    tips: '贸易站：维娜 + 摩根/推进之王。戴菲恩「运筹好手」须进驻中枢，按本站格拉斯哥人数加效率——一键不自动布置。',
    roomHints: {
      '摩根': 'TRADING',
      '推进之王': 'TRADING',
      '维娜·维多利亚': 'TRADING',
    },
    supportNotes: [
      { name: '戴菲恩', need: '中枢', text: '须进驻中枢，本贸易站每名格拉斯哥帮 +10%' },
    ],
  },
  {
    name: '拉特兰神枪手 (贸易站)',
    // 蕾缪安「相伴」只认本体能天使，不认新约能天使；勿把新约写进 core/partners（会误报必上）
    core: ['蕾缪安', '能天使'],
    partners: ['蕾缪安', '能天使'],
    tips: '蕾缪安「相伴」只认本体能天使（额外+25%），不认新约能天使。新约是另一条线：同站每名拉特兰+15%。第三人可塞吉星/空弦等。',
    lineup: [
      {
        role: '双人绑定',
        pick: ['蕾缪安', '能天使'],
        pair: true,
        fill: 'all',
        note: '相伴：蕾缪安 20%+25%，能天使自身 35%',
      },
    ],
    roomHints: {
      '蕾缪安': 'TRADING',
      '能天使': 'TRADING',
    },
  },
  {
    name: '怪物猎人 (木天蓼)',
    core: ['火龙S黑角'],
    partners: ['泰拉大陆调查团', '麒麟R夜刀'],
    tips: '火龙S黑角在中枢叠木天蓼；小队成员进驻相关设施。一键按技能房间布置，不塞宿舍。',
    roomHints: {
      '火龙S黑角': 'CONTROL',
    },
    supportNotes: [
      { name: '火龙S黑角', need: '中枢', text: '木天蓼计数须在中枢' },
    ],
  },
  {
    name: 'MyGO (热情值)',
    core: ['三角初华'],
    partners: [],
    tips: '热情值三人技能都在中枢生效（三角初华/若叶睦/丰川祥子）——一键不自动塞宿舍，请手动进驻中枢。',
    supportNotes: [
      { name: '三角初华', need: '中枢', text: '宿舍人头转热情值' },
      { name: '若叶睦', need: '中枢', text: '热情值→贸易效率' },
      { name: '丰川祥子', need: '中枢', text: '热情值→赤金制造' },
    ],
  },

  // --- 经典同房间联动 ---
  {
    name: '企鹅物流 (贸易站)',
    core: ['德克萨斯', '拉普兰德', '能天使'],
    partners: ['德克萨斯', '拉普兰德', '能天使']
  },
  {
    name: '剧团 (制造站)',
    core: ['酒神', 'Miss.Christine'],
    partners: ['酒神', 'Miss.Christine']
  },
  {
    // 双月强绑灰烬产情报储备；额外 R6 只为叠层，不是灰烬替补
    name: '彩虹永动→双月会客',
    core: ['双月', '灰烬'],
    partners: ['双月', '灰烬', '闪击', '战车', '霜华'],
    tips: '双月强绑灰烬：灰烬必须在中枢开启情报储备。每名中枢彩虹干员 +1 层（满 4）。会客双月技能 = 5% + 层数×5%（满配 25%）。闪击 / 战车 / 霜华是叠层用的额外 R6，不是灰烬的替换位。',
    lineup: [
      { role: '会客·强绑', pick: ['双月'], note: '吃情报储备；不可替换' },
      { role: '中枢·强绑', pick: ['灰烬'], note: '情报储备来源；不可替换' },
      {
        role: '中枢·叠层R6',
        pick: ['闪击', '战车', '霜华'],
        pair: true,
        fill: 'all',
        note: '与灰烬同站叠情报储备至满4层；不是灰烬替补',
      },
    ],
    roomHints: {
      '双月': 'MEETING',
      '灰烬': 'CONTROL', '闪击': 'CONTROL', '战车': 'CONTROL', '霜华': 'CONTROL',
    },
    supportNotes: [
      { name: '灰烬', need: '中枢', text: '双月强绑定；无灰烬则情报储备为 0' },
      { name: '闪击/战车/霜华', need: '中枢', text: '额外 R6 叠层（每名 +1），非灰烬替补' },
    ],
  },
  {
    // 森西宿舍产魔物料理 → 莱欧斯会客
    name: '森西食堂→莱欧斯会客',
    core: ['莱欧斯', '森西'],
    partners: ['莱欧斯', '森西'],
    tips: '森西精二进宿舍：宿舍每级+1魔物料理(Lv5=+5)。莱欧斯：好奇心+20% + 饱餐×2%/层。建议森西进Lv5宿舍。',
    lineup: [
      { role: '会客·绑定', pick: ['莱欧斯'], note: '吃魔物料理层数，不可替换' },
      { role: '宿舍·绑定', pick: ['森西'], note: '不可替换；建议 Lv5 宿舍叠满料理' },
    ],
    roomHints: {
      '莱欧斯': 'MEETING',
      '森西': 'DORMITORY',
    }
  },
  {
    // 彩虹永动原理：灰烬/闪击/战车/霜华 各带「彩虹小队」技能，每技能按中枢彩虹人数×0.05 减免且可叠加
    // 四人齐：4×(4×0.05)=0.80；全局人数减免 4×0.05=0.20 → 合计 1.0 刚好永动
    // 第5人可选增益；勿带艾拉（反抗者会+他人心情消耗）
    name: '彩虹中枢永动 (灰烬)',
    core: ['灰烬', '闪击', '战车', '霜华'],
    partners: ['灰烬', '闪击', '战车', '霜华', '阿米娅', '诗怀雅', '凯尔希', '夕'],
    singleRoom: true,
    lineup: [
      {
        role: '原理位·必上',
        pick: ['灰烬'],
        fill: 'all',
        note: '彩虹小队技能持有者，四人缺一不可（灰烬另带情报储备）'
      },
      {
        role: '原理位·必上',
        pick: ['闪击'],
        fill: 'all',
        note: '彩虹小队技能持有者，四人缺一不可'
      },
      {
        role: '原理位·必上',
        pick: ['战车'],
        fill: 'all',
        note: '彩虹小队技能持有者，四人缺一不可'
      },
      {
        role: '原理位·必上',
        pick: ['霜华'],
        fill: 'all',
        note: '彩虹小队技能持有者，四人缺一不可'
      },
      {
        role: '第5人·可选增益',
        pick: ['阿米娅', '诗怀雅', '凯尔希', '夕'],
        note: '可替换；阿米娅/诗怀雅偏贸易，凯尔希偏制造，夕偏感知。勿上艾拉'
      },
    ],
    tips: '形成原理：灰烬 + 闪击 + 战车 + 霜华 必须四人齐上（各自带「彩虹小队」技能，少一人永动不稳）。本中枢心情减免只认这四人技能；全局心情减免则是中枢里任意干员人数×0.05（5人吃满）。第5人可选增益位。严禁艾拉（反抗者会加他人消耗）。',
    roomHints: {
      '灰烬': 'CONTROL', '闪击': 'CONTROL', '战车': 'CONTROL', '霜华': 'CONTROL',
      '阿米娅': 'CONTROL', '诗怀雅': 'CONTROL', '凯尔希': 'CONTROL', '夕': 'CONTROL',
    }
  },
  {
    // 异格永动原理：炎狱炎熔/寒芒克洛丝/濯尘芙蓉 三人「异格者」技能各按中枢异格人数×0.05 减免
    // 必须三人齐（3技能）+ 再凑 2 名任意异格 → 中枢共 5 异格
    // 算法：3×(5×0.05)=0.75，加中枢人数心情减免 5×0.05=0.25 → 刚好抵消基础 1.0
    // 只有三人技能持有者、没有补位异格时：3×(3×0.05)+0.15=0.60，无法永动
    name: '异格中枢永动',
    core: ['炎狱炎熔', '寒芒克洛丝', '濯尘芙蓉'],
    partners: [
      '炎狱炎熔', '寒芒克洛丝', '濯尘芙蓉',
      '耀骑士临光', '假日威龙陈', '承曦格雷伊', '缄默德克萨斯', '纯烬艾雅法拉',
      '归溟幽灵鲨', '浊心斯卡蒂', '百炼嘉维尔', '焰影苇草', '新约能天使',
    ],
    singleRoom: true,
    lineup: [
      {
        role: '原理位·必上',
        pick: ['炎狱炎熔'],
        fill: 'all',
        note: '异格者技能持有者，三人缺一不可（不可用其他异格顶替）'
      },
      {
        role: '原理位·必上',
        pick: ['寒芒克洛丝'],
        fill: 'all',
        note: '异格者技能持有者，三人缺一不可（不可用其他异格顶替）'
      },
      {
        role: '原理位·必上',
        pick: ['濯尘芙蓉'],
        fill: 'all',
        note: '异格者技能持有者，三人缺一不可（不可用其他异格顶替）'
      },
      {
        role: '补位异格·任选1',
        pick: ['耀骑士临光', '假日威龙陈', '承曦格雷伊', '缄默德克萨斯', '纯烬艾雅法拉', '归溟幽灵鲨', '浊心斯卡蒂', '百炼嘉维尔', '焰影苇草', '新约能天使'],
        note: '任意异格干员凑人头（可替换）'
      },
      {
        role: '补位异格·任选2',
        pick: ['耀骑士临光', '假日威龙陈', '承曦格雷伊', '缄默德克萨斯', '纯烬艾雅法拉', '归溟幽灵鲨', '浊心斯卡蒂', '百炼嘉维尔', '焰影苇草', '新约能天使'],
        note: '任意异格干员凑人头（可替换）'
      },
    ],
    tips: '形成原理：炎狱炎熔 + 寒芒克洛丝 + 濯尘芙蓉 必须三人齐上（各自带「异格者」技能）。再加 2 名任意异格干员凑满 5 人——少一人都永动不了。本中枢心情减免只认三人技能；全局心情减免则是中枢任意人数×0.05（5人吃满）。补位异格可互换；原理三人不能顶替。',
    roomHints: {
      '炎狱炎熔': 'CONTROL', '寒芒克洛丝': 'CONTROL', '濯尘芙蓉': 'CONTROL',
      '耀骑士临光': 'CONTROL', '假日威龙陈': 'CONTROL', '承曦格雷伊': 'CONTROL',
      '缄默德克萨斯': 'CONTROL', '纯烬艾雅法拉': 'CONTROL', '归溟幽灵鲨': 'CONTROL',
      '浊心斯卡蒂': 'CONTROL', '百炼嘉维尔': 'CONTROL', '焰影苇草': 'CONTROL',
      '新约能天使': 'CONTROL',
    }
  },
  {
    // 默认一键：清流+温蒂+森蚺（制造）+ 承曦（发电晨曦）
    // 仅当核心干员已进驻时出现；空房间不刷推荐/互斥文案
    name: '自动化体系 (清流+承曦)',
    core: ['清流', '温蒂', '森蚺', '承曦格雷伊', '异客', '掠风'],
    partners: ['清流', '温蒂', '森蚺', '承曦格雷伊'],
    showInRooms: ['MANUFACTURE', 'POWER'],
    lineup: [
      { role: '制造·清流', pick: ['清流'], fill: 'all', note: '贸易×20%，不占发电' },
      { role: '制造·温蒂', pick: ['温蒂'], fill: 'all', note: '清零 + 按发电站' },
      { role: '制造·森蚺', pick: ['森蚺'], fill: 'all', note: '清零 + 按发电站' },
      { role: '发电·晨曦', pick: ['承曦格雷伊'], fill: 'all', note: '虚+1，其他发电站勿放作业平台' },
    ],
    tips: '一键布置：制造上清流+温蒂+森蚺，发电上承曦。',
    roomHints: {
      '清流': 'MANUFACTURE',
      '温蒂': 'MANUFACTURE',
      '森蚺': 'MANUFACTURE',
      '承曦格雷伊': 'POWER',
    }
  },
  {
    name: '阿兰娜·温米 (制造站)',
    core: ['阿兰娜'],
    partners: ['温米']
  },
];

window.oneClickDeploy = function(synName) {
  if (!selectedFacility) return;
  const syn = SYNERGY_LIST.find(s => s.name === synName);
  if (!syn) return;

  const idOf = (name) => Object.values(BUILDING_DATA.chars).find(c => c.name === name)?.id;
  const EFF_BASELINE = 25;

  /** 只往指定房间塞；singleRoom / 与选中同类型时禁止扩散到其它同类型设施 */
  const tryAssignTo = (charId, roomType, onlyIdx = null) => {
    const rooms = engine.layout[roomType];
    if (!rooms) return false;
    const indices = onlyIdx !== null ? [onlyIdx] : rooms.map((_, i) => i);
    for (const i of indices) {
      const room = rooms[i];
      if (!room) continue;
      if (room.operators.length < engine.getRoomCapacity(roomType, room.level)) {
        return engine.assignOperator(charId, roomType, i);
      }
    }
    return false;
  };

  const estimateRoomValue = (char, roomType) => {
    const skills = engine.getActiveSkills(char.id).filter(s => s.roomType === roomType);
    if (!skills.length) return 0;
    let best = 0;
    for (const s of skills) {
      const bid = s.buffId || '';
      let v = typeof s.efficiency === 'number' ? s.efficiency : 0;
      if (bid.startsWith('manu_prod_spd&power')) {
        const per = bid.includes('[020]') ? 15 : bid.includes('[010]') ? 10 : 5;
        v = per * Math.max(engine.getEffectivePowerCount(), 3);
      } else if (bid === 'manu_prod_spd&trade[000]') {
        v = 20 * Math.max(engine.layout.TRADING?.length || 0, 3);
      } else if (bid === 'manu_prod_spd&trade[1000]') {
        v = 3 * Math.max(engine.layout.TRADING?.length || 0, 3);
      } else if (bid === 'manu_prod_spd_variable2[000]') {
        v = 40; // 配合意识上限，一键估值用
      } else if (bid.startsWith('trade_ord_spd&share')) {
        v = (bid.includes('[002]') ? 20 : 10) * 2; // 估满员另2人
      } else if (bid === 'manu_prod_spd_bd[400]') {
        v = Math.max(engine.getMonsterCuisineCount?.() ?? 0, 5);
      } else if (bid.startsWith('manu_token_prod_spd')) {
        const per = bid.includes('[010]') ? 10 : 5;
        v = per * engine.getWorkPlatformCountInPower();
      } else if (bid === 'power_rec_drone[000]') {
        v = Math.min(25, Math.floor(engine.getDroneLimit() / 10));
      } else if (bid === 'power_count[000]' || bid === 'control_pow_bot[000]') {
        v = EFF_BASELINE;
      } else if (bid.startsWith('trade_ord_line') || bid.startsWith('trade_ord_spd&gold')) {
        v = EFF_BASELINE;
      } else if (bid === 'trade_ord_vodfox[000]') {
        v = 90;
      } else if (bid.startsWith('trade_ord_long') || bid.startsWith('trade_ord_wt&cost')
        || bid.startsWith('trade_ord_law') || bid.startsWith('trade_ord_against')) {
        v = EFF_BASELINE; // 投资/违约：价值在单均龙门币，不在获取速度
      } else if (bid.startsWith('control_') || roomType === 'CONTROL') {
        // 中枢技能（全局贸易/制造/派系等）数值常 <25，但仍必须进中枢才生效
        v = roomType === 'CONTROL' ? Math.max(v, EFF_BASELINE) : 0;
      } else if (roomType === 'DORMITORY' || roomType === 'WORKSHOP') {
        v = 0;
      } else if (roomType === 'TRAINING') {
        v = Math.max(v, 1);
      }
      best = Math.max(best, v);
    }
    return best;
  };

  const pickTargetRoom = (char) => {
    const hinted = syn.roomHints?.[char.name];
    if (hinted) return hinted;
    // 明确列入 supportNotes 的：只提示、不一键布置
    if (syn.supportNotes?.some(n => n.name === char.name)) return null;
    const ROOM_DEPLOY_PRIORITY = {
      MANUFACTURE: 0, TRADING: 1, POWER: 2, CONTROL: 3, MEETING: 4, HIRE: 5, TRAINING: 6,
    };
    const skillRooms = [...new Set(
      engine.getActiveSkills(char.id)
        .map(s => s.roomType)
        .filter(rt => rt && ROOM_DEPLOY_PRIORITY[rt] !== undefined)
    )];
    const candidates = skillRooms
      .map(rt => ({ rt, value: estimateRoomValue(char, rt) }))
      .filter(x => x.value >= EFF_BASELINE)
      .sort((a, b) =>
        b.value - a.value ||
        (ROOM_DEPLOY_PRIORITY[a.rt] ?? 99) - (ROOM_DEPLOY_PRIORITY[b.rt] ?? 99)
      );
    if (candidates[0]) return candidates[0].rt;
    // 无高分房间时：仍优先技能标注的设施（中枢等），绝不默认塞宿舍
    const soft = skillRooms
      .filter(rt => rt !== 'DORMITORY')
      .sort((a, b) => (ROOM_DEPLOY_PRIORITY[a] ?? 99) - (ROOM_DEPLOY_PRIORITY[b] ?? 99));
    return soft[0] || null;
  };

  let assignedCount = 0;
  const placedNames = [];
  const skippedNames = [];

  // ---- 按 lineup 占位：每个角色槽只上 1 人（等价替换取列表第一个空闲）----
  if (syn.lineup && syn.singleRoom) {
    const { roomType, roomIdx } = selectedFacility;
    const room = engine.layout[roomType]?.[roomIdx];
    if (!room) return;
    const cap = engine.getRoomCapacity(roomType, room.level);

    for (const slot of syn.lineup) {
      if (slot.skipDeploy) continue; // 仅说明用的人选（如单人40列举）
      if (room.operators.filter(Boolean).length >= cap) break;
      const fillAll = slot.fill === 'all' || slot.pair;
      // 共享人选池 / 双人组：fillAll 时上齐；否则本槽只上一人
      for (const name of slot.pick) {
        if (room.operators.filter(Boolean).length >= cap) break;
        const id = idOf(name);
        if (!id) continue;
        if (room.operators.includes(id)) {
          if (!fillAll) break;
          continue;
        }
        // 已在其它设施：拉回当前站（赤金线等顶配站序需要）
        const loc = getAssignedRoomLabel(id);
        if (loc && (loc.roomType !== roomType || loc.roomIdx !== roomIdx)) {
          engine.removeOperator(id);
        } else if (loc) {
          if (!fillAll) break;
          continue;
        }
        if (tryAssignTo(id, roomType, roomIdx)) {
          assignedCount++;
          placedNames.push(name);
          if (!fillAll) break;
        }
      }
    }
  } else if (syn.lineup) {
    // ---- 跨房间 lineup：fill=all 上齐名单；人在错房间则先撤再重上 ----
    for (const slot of syn.lineup) {
      const fillAll = slot.fill === 'all';
      for (const name of slot.pick) {
        const id = idOf(name);
        if (!id) continue;
        const hint = syn.roomHints?.[name];
        const loc = getAssignedRoomLabel(id);
        if (loc && hint && loc.roomType !== hint) {
          engine.removeOperator(id);
        } else if (loc && (!hint || loc.roomType === hint)) {
          if (!fillAll) break;
          continue;
        }
        const char = BUILDING_DATA.chars[id];
        const targetRoom = hint || pickTargetRoom(char);
        let success = false;
        if (targetRoom === selectedFacility.roomType) {
          success = tryAssignTo(id, targetRoom, selectedFacility.roomIdx);
        } else {
          success = tryAssignTo(id, targetRoom, null);
        }
        if (success) {
          assignedCount++;
          placedNames.push(name);
          if (!fillAll) break;
        }
      }
    }
  } else {
    // ---- 通用逻辑：与选中同类型只填当前站；跨类型才允许找其它空位 ----
    // 绝不兜底塞宿舍：宿舍只有 roomHints 显式指定时才去（如森西食堂）
    const partnerIds = syn.partners.map(n => idOf(n)).filter(Boolean);
    // 核心也按 roomHints 校正房间（如玛露西尔应在制造）
    const coreIds = (syn.core || []).map(n => idOf(n)).filter(Boolean);
    const deployIds = [...new Set([...coreIds, ...partnerIds])];

    for (const id of deployIds) {
      const char = BUILDING_DATA.chars[id];
      if (!char) continue;

      const targetRoom = pickTargetRoom(char);
      if (!targetRoom) {
        if (!getAssignedRoomLabel(id)) skippedNames.push(char.name);
        continue;
      }

      const loc = getAssignedRoomLabel(id);
      // 已在正确类型设施则跳过；错房间则先撤再布置
      if (loc && loc.roomType === targetRoom) {
        if (targetRoom === selectedFacility.roomType && loc.roomIdx === selectedFacility.roomIdx) continue;
        if (targetRoom !== selectedFacility.roomType) continue;
      }
      if (loc) engine.removeOperator(id);

      let success = false;
      if (targetRoom === selectedFacility.roomType) {
        success = tryAssignTo(id, targetRoom, selectedFacility.roomIdx);
      } else {
        // 宿舍等：优先高等级空位（森西叠魔物料理）
        if (targetRoom === 'DORMITORY') {
          const dorms = engine.layout.DORMITORY || [];
          const order = dorms
            .map((r, i) => ({ i, level: r.level || 1, n: (r.operators || []).filter(Boolean).length }))
            .filter(x => x.n < engine.getRoomCapacity('DORMITORY', x.level))
            .sort((a, b) => b.level - a.level || a.n - b.n);
          for (const { i } of order) {
            if (engine.assignOperator(id, 'DORMITORY', i)) { success = true; break; }
          }
        } else {
          success = tryAssignTo(id, targetRoom, null);
        }
      }

      if (success) {
        assignedCount++;
        placedNames.push(char.name);
      } else {
        skippedNames.push(char.name);
      }
    }
  }

  // 顶配站序重排（如赤金线：绮良→图耶→鸿雪）；已在岗也会重排
  let reordered = false;
  if (syn.slotOrder?.length && selectedFacility) {
    reordered = applySynergySlotOrder(syn, selectedFacility.roomType, selectedFacility.roomIdx);
  }

  if (assignedCount > 0 || reordered) {
    const who = placedNames.length ? `：${placedNames.join('、')}` : '';
    const scope = syn.singleRoom ? '（仅当前站）' : '';
    const orderTip = syn.slotOrder?.length ? ` · 站序 ${syn.slotOrder.join('→')}` : '';
    const tipExtra = skippedNames.length ? `（未布置：${skippedNames.join('、')}）` : '';
    showToast(
      assignedCount > 0
        ? `一键放置成功${scope}${who}${orderTip}${tipExtra}`
        : `已按顶配站序重排${orderTip}`,
      'success'
    );
    renderFacilities();
    if (selectedFacility) renderDetailPanel();
    renderOperators();
    updateGlobalStats();
    // 只提示与本次布置相关的冲突，避免把承曦/森蚺等旧问题当成「玛露西尔冲突」
    const relatedNames = [...new Set([...(syn.core || []), ...(syn.partners || []), ...placedNames])];
    const conflicts = engine.detectLayoutConflicts?.() || [];
    const bad = conflicts.filter(c =>
      (c.level === 'error' || c.level === 'warn') &&
      relatedNames.some(n => c.msg.includes(n))
    );
    if (bad.length) {
      showToast(bad[0].msg, 'error', 4500);
    }
  } else {
    const tip = skippedNames.length
      ? `未能布置：${skippedNames.join('、')}（请检查空位或 room 要求）`
      : (syn.supportNotes?.length
        ? '该策略的关键干员需特定设施，请看策略说明手动布置'
        : '所有推荐干员均已在岗、房间已满，或需特定设施（见策略说明）');
    showToast(tip, 'error');
  }
};

/** 按 syn.slotOrder 把干员拉到指定房间并重排（左→右） */
function applySynergySlotOrder(syn, roomType, roomIdx) {
  if (!syn?.slotOrder?.length) return false;
  const room = engine.layout[roomType]?.[roomIdx];
  if (!room) return false;
  const idOf = (name) => Object.values(BUILDING_DATA.chars).find(c => c.name === name)?.id;
  const cap = engine.getRoomCapacity(roomType, room.level);
  let changed = false;

  for (const name of syn.slotOrder) {
    const id = idOf(name);
    if (!id) continue;
    if (room.operators.includes(id)) continue;
    if (room.operators.filter(Boolean).length >= cap) break;
    if (engine.assignOperator(id, roomType, roomIdx)) changed = true;
  }

  const want = [];
  for (const name of syn.slotOrder) {
    const id = idOf(name);
    if (id && room.operators.includes(id)) want.push(id);
  }
  const rest = room.operators.filter(id => id && !want.includes(id));
  const next = [...want, ...rest];
  const same = next.length === room.operators.length
    && next.every((id, i) => id === room.operators[i]);
  if (!same) {
    room.operators = next;
    changed = true;
  }
  return changed;
}

/** 当前布局下应展示的推荐搭配（含是否仍可一键补人） */
function collectVisibleSynergies() {
  if (!selectedFacility) return [];
  const selRoom = selectedFacility.roomType;
  const assignedNames = [];
  for (const rt in engine.layout) {
    for (const room of engine.layout[rt]) {
      for (const id of room.operators) {
        if (id && BUILDING_DATA.chars[id]) assignedNames.push(BUILDING_DATA.chars[id].name);
      }
    }
  }

  const roomOps = engine.layout[selRoom][selectedFacility.roomIdx].operators;
  const roomCap = engine.getRoomCapacity(selRoom, engine.layout[selRoom][selectedFacility.roomIdx].level);
  const list = [];

  for (const syn of SYNERGY_LIST) {
    if (!syn.core.some(c => assignedNames.includes(c))) continue;
    if (syn.showInRooms && !syn.showInRooms.includes(selRoom)) continue;

    const availablePartners = syn.partners.filter(name => {
      const id = Object.values(BUILDING_DATA.chars).find(c => c.name === name)?.id;
      return id && !isAssignedToHint(id, syn, name);
    });

    let lineupIncomplete = false;
    if (syn.lineup) {
      lineupIncomplete = syn.lineup.some(slot => {
        if (slot.skipDeploy) return false; // 展示用条目不挡「已齐」
        const fillAll = slot.fill === 'all' || slot.pair;
        if (fillAll) {
          const missing = slot.pick.some(n => {
            const id = Object.values(BUILDING_DATA.chars).find(c => c.name === n)?.id;
            return id && !isAssignedToHint(id, syn, n);
          });
          if (!missing) return false;
          if (syn.singleRoom && roomOps.length >= roomCap) return false;
          return true;
        }
        const slotFilled = slot.pick.some(n => {
          const id = Object.values(BUILDING_DATA.chars).find(c => c.name === n)?.id;
          return id && isAssignedToHint(id, syn, n);
        });
        if (slotFilled) return false;
        const hasFree = slot.pick.some(n => {
          const id = Object.values(BUILDING_DATA.chars).find(c => c.name === n)?.id;
          return id && !isAssignedToHint(id, syn, n);
        });
        if (!hasFree) return false;
        if (syn.singleRoom && roomOps.length >= roomCap) return false;
        return true;
      });
    } else {
      lineupIncomplete = availablePartners.length > 0;
    }

    // 顶配站序未对齐时仍显示一键（可重排）
    let orderIncomplete = false;
    if (syn.slotOrder?.length && selRoom === (syn.roomHints?.[syn.slotOrder[0]] || selRoom)) {
      const curNames = roomOps.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
      const want = syn.slotOrder.filter(n => curNames.includes(n));
      if (want.length >= 2) {
        const idx = want.map(n => curNames.indexOf(n));
        for (let i = 1; i < idx.length; i++) {
          if (idx[i] < idx[i - 1]) { orderIncomplete = true; break; }
        }
      }
      // 人在其它同类型站：也算未完成，便于一键拉回当前站
      if (!orderIncomplete && syn.singleRoom) {
        orderIncomplete = syn.slotOrder.some(n => {
          const id = Object.values(BUILDING_DATA.chars).find(c => c.name === n)?.id;
          if (!id) return false;
          const loc = getAssignedRoomLabel(id);
          return loc && (loc.roomType !== selRoom || loc.roomIdx !== selectedFacility.roomIdx)
            && (!syn.roomHints?.[n] || syn.roomHints[n] === selRoom);
        });
      }
    }

    // 仅有 supportNotes、无可一键伙伴时：右侧仍可提示策略名（无有效按钮目标则不推）
    if (!lineupIncomplete && !orderIncomplete && availablePartners.length === 0) continue;
    list.push(syn);
  }
  return list;
}

function buildSupportNotesHtml(syn) {
  if (!syn.supportNotes?.length) return '';
  const items = syn.supportNotes.map(n => {
    const who = n.name ? `<b>${n.name}</b>` : '';
    const need = n.need ? `<span class="synergy-need">→ ${n.need}</span>` : '';
    return `<div class="synergy-support-item">${who}${need}${n.text ? `：${n.text}` : ''}</div>`;
  }).join('');
  return `<div class="synergy-support-notes"><div class="synergy-support-title">特殊设施（一键不自动塞宿舍）</div>${items}</div>`;
}

function buildSynergyLineupHtml(syn, { replacementsOnly = false } = {}) {
  const supportHtml = buildSupportNotesHtml(syn);
  if (syn.lineup) {
    const lines = syn.lineup.map(slot => {
      const primary = slot.pick[0];
      const alts = slot.pick.slice(1);
      // 双人组：整组展示，避免拆成「两个各40%」
      if (slot.pair || (slot.fill === 'all' && slot.pick.length > 1 && /双人|合计/.test(slot.role || ''))) {
        const duo = slot.pick.join(' + ');
        const cls = replacementsOnly ? 'synergy-line synergy-fixed' : 'synergy-line';
        return `<div class="${cls}"><b>${slot.role}</b>：${duo}<span class="synergy-note">（${slot.note}）</span></div>`;
      }
      const fixed = alts.length === 0 || slot.fill === 'all';
      if (replacementsOnly) {
        if (fixed) {
          return `<div class="synergy-line synergy-fixed"><b>${slot.role}</b>：${primary}<span class="synergy-note">（${slot.note}）</span></div>`;
        }
        return `<div class="synergy-line synergy-replace"><b>${slot.role}</b>：可替换 ${[primary, ...alts].join(' / ')}<span class="synergy-note">（${slot.note}）</span></div>`;
      }
      const altStr = alts.length
        ? ` <span class="synergy-alts">≈ ${alts.join(' / ')}</span>`
        : '';
      return `<div class="synergy-line"><b>${slot.role}</b>：${primary}${altStr}<span class="synergy-note">（${slot.note}）</span></div>`;
    }).filter(Boolean).join('');
    return `
      <div class="synergy-lineup">
        ${syn.tips ? `<div class="synergy-tips">${syn.tips}</div>` : ''}
        ${lines}
        ${supportHtml}
      </div>`;
  }
  if (replacementsOnly && syn.partners?.length) {
    const roomNames = selectedFacility
      ? engine.layout[selectedFacility.roomType][selectedFacility.roomIdx].operators
          .map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean)
      : [];
    const coreSet = new Set(syn.core || []);
    const missing = syn.partners.filter(n => !roomNames.includes(n));
    const bound = missing.filter(n => coreSet.has(n));
    const alts = missing.filter(n => !coreSet.has(n));
    const boundHtml = bound.length
      ? `<div class="synergy-line synergy-fixed"><b>绑定 · 必上</b>：${bound.join(' / ')}</div>`
      : '';
    const altHtml = alts.length
      ? `<div class="synergy-line synergy-replace"><b>可替换</b>：${alts.join(' / ')}</div>`
      : '';
    if (boundHtml || altHtml || supportHtml || syn.tips) {
      return `<div class="synergy-lineup">
        ${syn.tips ? `<div class="synergy-tips">${syn.tips}</div>` : ''}
        ${boundHtml}
        ${altHtml}
        ${supportHtml}
      </div>`;
    }
  }
  if (syn.tips || supportHtml) {
    return `<div class="synergy-lineup">${syn.tips ? `<div class="synergy-tips">${syn.tips}</div>` : ''}${supportHtml}</div>`;
  }
  return '';
}

/**
 * 中间详情：只认「当前设施里已进驻核心」的那一套策略，
 * 展示替换人选，不放一键按钮（一键只在右侧红框）
 */
function getCurrentRoomStrategy() {
  if (!selectedFacility) return null;
  const { roomType, roomIdx } = selectedFacility;
  const roomOps = engine.layout[roomType]?.[roomIdx]?.operators || [];
  const roomNames = roomOps.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
  if (!roomNames.length) return null;

  const scored = [];
  for (const syn of SYNERGY_LIST) {
    if (syn.showInRooms && !syn.showInRooms.includes(roomType)) continue;
    const coreInRoom = syn.core.filter(c => roomNames.includes(c)).length;
    if (!coreInRoom) continue;
    const partnerInRoom = (syn.partners || []).filter(n => roomNames.includes(n)).length;
    scored.push({ syn, score: coreInRoom * 10 + partnerInRoom });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].syn;
}

/** 中间详情区：当前策略的替换说明（无一键） */
function renderDetailSynergies() {
  const host = document.getElementById('detailSynergyPanel');
  if (!host) return;
  const syn = getCurrentRoomStrategy();
  if (!syn) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  const body = buildSynergyLineupHtml(syn, { replacementsOnly: true });
  if (!body || !body.replace(/<[^>]+>/g, '').trim()) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  host.style.display = 'flex';
  host.innerHTML = `
    <div class="synergy-detail-card">
      <div class="synergy-detail-head">
        <span class="synergy-detail-title">⭐ 当前策略 · ${syn.name}</span>
      </div>
      ${body}
    </div>`;
}

/** 右侧干员栏：仅标题+按钮 */
function appendOperatorSynergyCompact(fragment) {
  collectVisibleSynergies().forEach(syn => {
    const btnLabel = syn.singleRoom ? '一键·当前站' : '一键放置';
    const synBox = document.createElement('div');
    synBox.className = 'synergy-recommend synergy-compact';
    synBox.innerHTML = `
      <div class="synergy-compact-inner">
        <span class="synergy-compact-title" title="${syn.name}">⭐ ${syn.name}</span>
        <button class="product-btn active syn-deploy-btn" type="button">${btnLabel}</button>
      </div>`;
    synBox.querySelector('.syn-deploy-btn')?.addEventListener('click', () => window.oneClickDeploy(syn.name));
    fragment.appendChild(synBox);
  });
}

// ============================================================
// 干员列表渲染
// ============================================================
function renderOperators() {
  const list = document.getElementById('operatorsList');
  list.innerHTML = '';

  let chars = Object.values(BUILDING_DATA.chars);

  // 搜索过滤
  if (searchText) {
    const q = searchText.toLowerCase();
    chars = chars.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }

  // 设施类型过滤
  const activeRoom = filterRoom;
  if (activeRoom !== 'ALL' && activeRoom !== 'UNASSIGNED' && !isAutoRoomFilter) {
    chars = chars.filter(c => c.skills.some(s => s.roomType === activeRoom));
  }

  // 稀有度过滤
  if (filterRarity !== 'ALL') {
    const r = parseInt(filterRarity);
    chars = chars.filter(c => c.rarity === r);
  }

  // 未分配过滤
  if (showUnassigned) {
    chars = chars.filter(c => !getAssignedRoomLabel(c.id));
  }

  const selRoom = selectedFacility?.roomType;
  const fragment = document.createDocumentFragment();

  // 推荐：右侧紧凑按钮；完整说明在中间详情
  appendOperatorSynergyCompact(fragment);
  if (document.getElementById('detailSynergyPanel')) renderDetailSynergies();

  function appendGroup(title, charArray, opts = {}) {
    if (charArray.length === 0) return;
    const sep = document.createElement('div');
    sep.className = 'op-group-sep';
    const meta = opts.meta
      ? `<span class="op-group-meta" title="${opts.metaTitle || ''}">${opts.meta}</span>`
      : '';
    sep.innerHTML = `<span class="op-group-title">${title}</span>${meta}`;
    fragment.appendChild(sep);

    charArray.forEach(char => {
      const card = createOpCard(char, true);
      fragment.appendChild(card);
    });
  }

  if (selRoom && isAutoRoomFilter) {
    // ---- 训练室：艾丽妮/逻各斯断档 → 专三特化 → 其余按峰值速度 ----
    if (selRoom === 'TRAINING') {
      const TRAIN_PIN = ['艾丽妮', '逻各斯'];
      const trainChars = [];
      const noneChars = [];

      const peakTrainEff = (skills) => {
        let peak = 0;
        for (const s of skills) {
          const d = s.desc || '';
          const bid = s.buffId || '';
          // 下次训练时长减免 / 心情惩罚：不参与速度排序
          if (bid.startsWith('train_spd_reduceTime')) continue;
          if (typeof s.efficiency === 'number' && s.efficiency < 0) continue;
          if (/心情每小时消耗\+/.test(d) && !/训练速度/.test(d) && (s.efficiency || 0) <= 1) continue;

          let base = typeof s.efficiency === 'number' ? Math.max(0, s.efficiency) : 0;
          // 「至N级则额外+X%」按专精条件峰值计
          const m = d.match(/专精技能至(\d)级[^。]*?训练速度额外\+(\d+(?:\.\d+)?)%/);
          if (m) {
            // 文案常写「+30%，如果…额外+65%」→ 峰值 = 30+65；efficiency 字段往往只标了30
            const main = d.match(/训练速度\+(\d+(?:\.\d+)?)%/);
            const flat = main ? +main[1] : base;
            peak = Math.max(peak, flat + (+m[2]));
            continue;
          }
          // 望：仅专三时 +70%
          const only = d.match(/如果本次训练专精技能至(\d)级[，,]专精技能训练速度\+(\d+(?:\.\d+)?)%/);
          if (only) {
            peak = Math.max(peak, +only[2]);
            continue;
          }
          // 分支特化等：基础+额外
          const branch = d.match(/训练速度额外\+(\d+(?:\.\d+)?)%/);
          if (branch) {
            const main = d.match(/训练速度\+(\d+(?:\.\d+)?)%/);
            const flat = main ? +main[1] : base;
            peak = Math.max(peak, flat + (+branch[1]));
            continue;
          }
          peak = Math.max(peak, base);
        }
        return peak;
      };

      chars.forEach(char => {
        const skills = engine.getActiveSkills(char.id).filter(s => s.roomType === 'TRAINING');
        if (!skills.length) {
          noneChars.push(char);
          return;
        }
        const hasReduce = skills.some(s => (s.buffId || '').startsWith('train_spd_reduceTime'));
        const masteryLv = getTrainMasteryLevel(skills);
        const hasM3 = masteryLv === 3 || skills.some(s => /专精技能至3级/.test(s.desc || ''));
        const pinIdx = TRAIN_PIN.indexOf(char.name);
        char._trainPin = pinIdx >= 0 || hasReduce ? (pinIdx >= 0 ? pinIdx : 10) : 99;
        char._trainM3 = hasM3 ? 1 : 0;
        char._trainMastery = masteryLv; // 1/2/3，卡片直接显示专一/专二/专三
        char._trainTargets = masteryLv
          ? getTrainTargetProfessions(skills, { anyMastery: true }).join('·')
          : '';
        char._maxEff = peakTrainEff(skills);
        trainChars.push(char);
      });

      trainChars.sort((a, b) =>
        a._trainPin - b._trainPin ||
        b._trainM3 - a._trainM3 ||
        b._maxEff - a._maxEff ||
        b.rarity - a.rarity ||
        a.name.localeCompare(b.name, 'zh-CN')
      );
      noneChars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));

      const pinGroup = trainChars.filter(c => c._trainPin < 99);
      const m3Group = trainChars.filter(c => c._trainPin >= 99 && c._trainM3);
      const restGroup = trainChars.filter(c => c._trainPin >= 99 && !c._trainM3);

      appendGroup('⭐ 断档核心 (下次训练-50%)', pinGroup);

      // 专精特化：专三按面向职业分组；专一/专二单独成组（卡片上都会标等级）
      const mastery12 = restGroup.filter(c => c._trainMastery === 1 || c._trainMastery === 2);
      const restNoMastery = restGroup.filter(c => !c._trainMastery);

      const m3Buckets = new Map();
      for (const char of m3Group) {
        const key = char._trainTargets || '其他';
        if (!m3Buckets.has(key)) m3Buckets.set(key, []);
        m3Buckets.get(key).push(char);
      }
      const m3Keys = [...m3Buckets.keys()].sort((a, b) => {
        const pa = PROFESSION_ORDER.indexOf(a.split('·')[0]);
        const pb = PROFESSION_ORDER.indexOf(b.split('·')[0]);
        return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.localeCompare(b, 'zh-CN');
      });
      if (m3Keys.length) {
        const sep = document.createElement('div');
        sep.style.cssText = 'font-size:11px;font-weight:bold;color:var(--text-muted);padding:8px 4px 4px;margin-top:4px;border-bottom:1px solid var(--border);';
        sep.textContent = '专三特化（按面向职业）';
        fragment.appendChild(sep);
        for (const key of m3Keys) {
          const list = m3Buckets.get(key);
          list.sort((a, b) => b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
          appendGroup(`　${key}`, list);
        }
      }

      if (mastery12.length) {
        mastery12.sort((a, b) =>
          b._trainMastery - a._trainMastery ||
          b._maxEff - a._maxEff ||
          b.rarity - a.rarity ||
          a.name.localeCompare(b.name, 'zh-CN')
        );
        appendGroup('专一 / 专二特化', mastery12);
      }
      appendGroup('其他训练 (按峰值)', restNoMastery);
      appendGroup('无加成 / 其他干员', noneChars);
    } else if (selRoom === 'MANUFACTURE') {
      // ---- 制造站干员库：通用/专项 → 单人/搭配 → 需要配|一到二人|系列 ----
      const manuRoom = engine.layout.MANUFACTURE[selectedFacility.roomIdx];
      const product = manuRoom?.product || 'GOLD';
      const productName = PRODUCT_MAP.MANUFACTURE[product] || product;
      const roomOpsNames = (manuRoom?.operators || []).map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
      const needsCapacitySort = roomOpsNames.includes('红云') || roomOpsNames.includes('泡泡');

      const capacityChars = [];
      const mismatchChars = [];
      const noneChars = [];
      /** @type {Record<string, any[]>} */
      const buckets = {};
      const bucketKey = (lane, mode, synKind, series) => {
        if (lane === 'mismatch' || lane === 'none') return lane;
        const laneTitle = lane === 'special' ? `专项·${productName}` : '通用';
        if (mode === 'solo') return `${laneTitle}|solo`;
        if (synKind === 'series') return `${laneTitle}|series|${series || '其它系列'}`;
        if (synKind === 'need_partner') return `${laneTitle}|need`;
        return `${laneTitle}|pair`; // small_team
      };

      chars.forEach(char => {
        const hasManu = (char.skills || []).some(s => s.roomType === 'MANUFACTURE');
        if (!hasManu) return;
        const est = classifyManufactureOpForList(char, product);
        char._maxEff = est.score;
        char._maxCap = est.cap;
        char._manuDetail = est;
        if (est.lane === 'none') {
          noneChars.push(char);
          return;
        }
        if (needsCapacitySort && est.cap > 0) {
          capacityChars.push(char);
          return;
        }
        if (est.lane === 'mismatch') {
          mismatchChars.push(char);
          return;
        }
        const key = bucketKey(est.lane, est.mode, est.synKind, est.series);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(char);
      });

      const byEff = (a, b) =>
        b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN');
      for (const list of Object.values(buckets)) list.sort(byEff);
      capacityChars.sort((a, b) => b._maxCap - a._maxCap || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
      mismatchChars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
      noneChars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));

      if (capacityChars.length) appendGroup('⭐ 库容优先（红云/泡泡在站）', capacityChars);

      const emitLane = (lanePrefix, laneLabel) => {
        const solo = buckets[`${lanePrefix}|solo`] || [];
        const need = buckets[`${lanePrefix}|need`] || [];
        const pair = buckets[`${lanePrefix}|pair`] || [];
        const seriesKeys = Object.keys(buckets)
          .filter(k => k.startsWith(`${lanePrefix}|series|`))
          .sort((a, b) => a.localeCompare(b, 'zh-CN'));
        if (!solo.length && !need.length && !pair.length && !seriesKeys.length) return;

        const head = document.createElement('div');
        head.className = 'op-group-sep';
        head.innerHTML = `<span class="op-group-title">【${laneLabel}】</span><span class="op-group-meta" title="右侧数字均为满配峰值：玛露西尔按森西Lv5料理、清流按3贸易站、温蒂/森蚺按3发电等；条件不够时实际更低">下列均为满配峰值</span>`;
        fragment.appendChild(head);

        appendGroup('　单人效率', solo);
        if (need.length || pair.length || seriesKeys.length) {
          const synHead = document.createElement('div');
          synHead.className = 'op-group-sep';
          synHead.innerHTML = `<span class="op-group-title">　有搭配</span><span class="op-group-meta" title="点名同站/系列人数等按满配估算，未配齐时实际更低">需条件才达标</span>`;
          fragment.appendChild(synHead);
          appendGroup('　　需要配（点名干员）', need, {
            meta: '满配峰值',
            metaTitle: '需点名干员同站才有此峰值（如烈夏需古米在贸易）',
          });
          appendGroup('　　一到二人（同站计数/抄效率）', pair, {
            meta: '满配峰值',
            metaTitle: '按同站技能数/抄效率满额估算',
          });
          for (const sk of seriesKeys) {
            const name = sk.split('|')[2] || '系列';
            appendGroup(`　　搭配系列 · ${name}`, buckets[sk], {
              meta: '满配峰值',
              metaTitle: `按${name}人数满配估算`,
            });
          }
        }
      };

      emitLane('通用', '通用');
      emitLane(`专项·${productName}`, `专项 · ${productName}`);
      appendGroup('其他产物专精（当前不生效）', mismatchChars);
      appendGroup('无制造技能 / 其他干员', noneChars);
    } else if (selRoom === 'MEETING') {
      // ---- 会客室：默认精二；按 隐藏进驻(星级差) + 技能峰值 排序 ----
      const speedChars = [];
      const soloChars = [];
      const biasChars = [];
      const noneChars = [];

      chars.forEach(char => {
        const hasMeet = (char.skills || []).some(s => s.roomType === 'MEETING');
        if (!hasMeet) return; // 会客室列表只列有会客技能的干员
        const est = estimateMeetingScore(char);
        char._maxEff = est.score;
        char._meetDetail = est;
        if (est.kind === 'solo') soloChars.push(char);
        else if (est.kind === 'speed') speedChars.push(char);
        else if (est.kind === 'bias') biasChars.push(char);
        else noneChars.push(char);
      });

      const byScore = (a, b) =>
        b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN');
      speedChars.sort(byScore);
      soloChars.sort(byScore);
      biasChars.sort(byScore);
      noneChars.sort(byScore);

      appendGroup('线索速度（技能+精二隐藏）', speedChars, {
        meta: '下列均为满配峰值',
        metaTitle: '右侧数字按精二 + 技能满配峰值估算，不是进站就一定有。例如忍冬需铃兰同站、双月需灰烬情报储备、莱欧斯需森西料理等，条件不满足时实际更低。',
      });
      appendGroup('独处特化（仅1人时）', soloChars);
      appendGroup('派系/倾向', biasChars);
      if (noneChars.length) appendGroup('其他会客技能', noneChars);
    } else if (selRoom === 'HIRE') {
      const speedChars = [];
      const biasChars = [];
      const noneChars = [];

      chars.forEach(char => {
        const hasHire = (char.skills || []).some(s => s.roomType === 'HIRE');
        if (!hasHire) return;
        const est = estimateHireScore(char);
        char._maxEff = est.score;
        char._hireDetail = est;
        if (est.kind === 'speed') speedChars.push(char);
        else if (est.kind === 'bias') biasChars.push(char);
        else noneChars.push(char);
      });

      const byScore = (a, b) =>
        b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN');
      speedChars.sort(byScore);
      biasChars.sort(byScore);
      noneChars.sort(byScore);

      appendGroup('联络速度', speedChars, {
        meta: '下列均为满配峰值',
        metaTitle: '右侧数字按满配峰值估算。锡人靠宿舍等级合计；乌有/月禾联络固定，额外招募位只拐会客（初始2栏不含）。条件不够时实际更低。',
      });
      appendGroup('机制/倾向', biasChars);
      if (noneChars.length) appendGroup('其他办公室技能', noneChars);
    } else if (selRoom === 'TRADING') {
      const speedChars = [];
      const biasChars = [];
      const noneChars = [];
      chars.forEach(char => {
        const has = (char.skills || []).some(s => s.roomType === 'TRADING');
        if (!has) return;
        const est = estimateTradingScore(char);
        char._maxEff = est.score;
        char._tradeDetail = est;
        if (est.kind === 'speed') speedChars.push(char);
        else if (est.kind === 'bias') biasChars.push(char);
        else noneChars.push(char);
      });
      const byScore = (a, b) =>
        b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN');
      speedChars.sort(byScore);
      biasChars.sort(byScore);
      noneChars.sort(byScore);
      appendGroup('获取速度', speedChars, {
        meta: '下列均为满配峰值',
        metaTitle: '右侧按满配峰值估（宿舍等级/同站人数/人间烟火等）。条件不够时实际更低。',
      });
      appendGroup('投资/违约/倾向', biasChars);
      if (noneChars.length) appendGroup('其他贸易技能', noneChars);
    } else if (selRoom === 'POWER') {
      const speedChars = [];
      const biasChars = [];
      const noneChars = [];
      chars.forEach(char => {
        const has = (char.skills || []).some(s => s.roomType === 'POWER');
        if (!has) return;
        const est = estimatePowerScore(char);
        char._maxEff = est.score;
        char._powerDetail = est;
        if (est.kind === 'speed') speedChars.push(char);
        else if (est.kind === 'bias') biasChars.push(char);
        else noneChars.push(char);
      });
      const byScore = (a, b) =>
        b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN');
      speedChars.sort(byScore);
      biasChars.sort(byScore);
      noneChars.sort(byScore);
      appendGroup('无人机充能', speedChars, {
        meta: '下列均为满配峰值',
        metaTitle: '右侧按满配峰值估（工时满额/无人机上限等）。条件不够时实际更低。',
      });
      appendGroup('机制（加设施数等）', biasChars);
      if (noneChars.length) appendGroup('其他发电技能', noneChars);
    } else {
    let independentChars = [];
    let synergyChars = [];
    let capacityChars = [];
    let noneChars = [];
    
    const roomOpsNames = selectedFacility ? engine.layout[selectedFacility.roomType][selectedFacility.roomIdx].operators.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean) : [];
    const needsCapacitySort = selRoom === 'MANUFACTURE' && (roomOpsNames.includes('红云') || roomOpsNames.includes('泡泡'));

    chars.forEach(char => {
      let hasMatch = false;
      let maxEff = 0;
      let maxCap = 0;
      let isSyn = false;
      
      const activeSkills = engine.getActiveSkills(char.id).filter(s => s.roomType === selRoom);
      if (activeSkills.length > 0) {
        hasMatch = true;
        isSyn = activeSkills.some(s => s.desc.match(/每有|每名|搭配|小队|同房间|感知信息|记忆碎片|杜林|深海猎人|莱欧斯|魔物料理|设施数量|作业平台|发电站额外|贸易站为/));
        maxEff = Math.max(...activeSkills.map(s => {
          // 承曦格雷伊·巡线框架：按当前无人机上限估算排序权重
          if (s.buffId === 'power_rec_drone[000]') {
            return Math.min(25, Math.floor(engine.getDroneLimit() / 10));
          }
          // 晨曦不提供充能，给一个中等权重以便出现在组合搭配
          if (s.buffId === 'power_count[000]') return 0;
          return s.efficiency || 0;
        }));
        maxCap = Math.max(...activeSkills.map(s => s.capacity || 0));
      }
      char._maxEff = maxEff;
      char._maxCap = maxCap;
      
      if (hasMatch) {
        if (needsCapacitySort && maxCap > 0) {
          capacityChars.push(char);
        } else if (isSyn) {
          synergyChars.push(char);
        } else {
          independentChars.push(char);
        }
      } else {
        noneChars.push(char);
      }
    });

    independentChars.sort((a, b) => b._maxEff - a._maxEff || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
    synergyChars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
    capacityChars.sort((a, b) => b._maxCap - a._maxCap || b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
    noneChars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));

    if (capacityChars.length > 0) appendGroup('⭐ 特殊配合 (仓库容量优先)', capacityChars);
    appendGroup('独立加成', independentChars);
    appendGroup('组合搭配', synergyChars);
    appendGroup('无加成 / 其他干员', noneChars);
    }
  } else {
    // 手动筛选时只排序
    chars.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh-CN'));
    appendGroup('干员列表', chars);
  }

  list.appendChild(fragment);
}

function createOpCard(char, isHighlighted = false) {
  const assignment = getAssignedRoomLabel(char.id);
  const card = document.createElement('div');
  card.className = `op-card${assignment ? ' assigned' : ''}${isHighlighted ? ' skill-match' : ''}`;
  card.dataset.charId = char.id;
  if (assignment) card.dataset.room = assignment.label;

  // 精二技能标签（过滤掉精0要求的）
  const e2Skills = char.skills.filter(s => s.eliteReq <= 2);
  const skillTags = [...new Set(e2Skills.map(s => s.roomType))]
    .filter(Boolean)
    .map(rt => `<span class="op-skill-tag skill-tag-${rt}">${ROOM_META[rt]?.name?.slice(0, 2) || rt}</span>`)
    .join('');
  const profLabel = getProfessionLabel(char);
  const profStyle = getProfessionStyle(char);
  // 对照当前选中设施：显示该设施技能所需精一/精二
  // 会客室特例：一律标「精二」——隐藏精英加成按精二算，与技能解锁档无关
  const selRoom = selectedFacility?.roomType;
  let eliteNeed = selRoom ? formatEliteNeed(getFacilityEliteNeed(char, selRoom)) : null;
  if (selRoom === 'MEETING') {
    eliteNeed = { text: '精二', cls: 'elite-need-2' };
  }
  const eliteBadge = eliteNeed
    ? `<span class="op-elite-tag ${eliteNeed.cls}" title="${selRoom === 'MEETING' ? '会客室默认按精二结算隐藏+16%（即使技能精一解锁）' : '当前设施技能完整效果所需精英'}">${eliteNeed.text}</span>`
    : '';
  const meetScore = (selRoom === 'MEETING' && char._meetDetail)
    ? `<div class="op-card-metric" title="满配峰值：本体${char._meetDetail.base}% + 技能${char._meetDetail.skillPeak}%${char._meetDetail.note ? '；' + char._meetDetail.note : ''}（条件不满足时实际更低）"><span class="op-metric-total">+${char._meetDetail.score}%</span><span class="op-metric-sub">${char._meetDetail.base}<i>+</i>${char._meetDetail.skillPeak}</span>${char._meetDetail.peakNeed ? `<span class="op-metric-need">${char._meetDetail.peakNeed}</span>` : ''}</div>`
    : '';
  const hireScore = (selRoom === 'HIRE' && char._hireDetail && char._hireDetail.kind !== 'none')
    ? `<div class="op-card-metric" title="满配峰值联络速度 +${char._hireDetail.score}%${char._hireDetail.note ? '；' + char._hireDetail.note : ''}（条件不满足时实际更低）"><span class="op-metric-total">+${char._hireDetail.score}%</span>${char._hireDetail.peakNeed ? `<span class="op-metric-need">${char._hireDetail.peakNeed}</span>` : ''}</div>`
    : '';
  const tradeScore = (selRoom === 'TRADING' && char._tradeDetail && char._tradeDetail.kind !== 'none')
    ? `<div class="op-card-metric" title="满配峰值 +${char._tradeDetail.score}%${char._tradeDetail.note ? '；' + char._tradeDetail.note : ''}"><span class="op-metric-total">${char._tradeDetail.score > 0 ? `+${Math.round(char._tradeDetail.score)}%` : '—'}</span>${char._tradeDetail.peakNeed ? `<span class="op-metric-need">${char._tradeDetail.peakNeed}</span>` : ''}</div>`
    : '';
  const powerScore = (selRoom === 'POWER' && char._powerDetail && char._powerDetail.kind !== 'none')
    ? `<div class="op-card-metric" title="满配峰值 +${char._powerDetail.score}%${char._powerDetail.note ? '；' + char._powerDetail.note : ''}"><span class="op-metric-total">${char._powerDetail.score > 0 ? `+${Math.round(char._powerDetail.score)}%` : '—'}</span>${char._powerDetail.peakNeed ? `<span class="op-metric-need">${char._powerDetail.peakNeed}</span>` : ''}</div>`
    : '';
  const manuScore = (selRoom === 'MANUFACTURE' && char._manuDetail && char._manuDetail.kind !== 'none' && char._manuDetail.kind !== 'mismatch')
    ? `<div class="op-card-metric" title="${char._manuDetail.note || ('满配峰值 +' + Math.round(char._manuDetail.score) + '%')}（条件不满足时实际更低）"><span class="op-metric-total">${char._manuDetail.score > 0 ? `+${Math.round(char._manuDetail.score)}%` : '—'}</span>${char._manuDetail.peakNeed ? `<span class="op-metric-need">${char._manuDetail.peakNeed}</span>` : ''}</div>`
    : (selRoom === 'MANUFACTURE' && char._manuDetail?.kind === 'mismatch'
      ? `<div class="op-card-metric is-muted" title="技能绑定其他产物，当前无效"><span class="op-metric-total">—</span></div>`
      : '');
  // 训练室：专精特化等级常显（专一/专二/专三），面向职业也直接写出，无需悬停
  const trainMasteryBadge = (selRoom === 'TRAINING' && char._trainMastery)
    ? `<span class="op-train-mastery mastery-${char._trainMastery}" title="专精特化：训练专精至${char._trainMastery}级时额外加速">${formatTrainMasteryLabel(char._trainMastery)}</span>`
    : '';
  const trainTargetBadge = (selRoom === 'TRAINING' && char._trainTargets)
    ? `<span class="op-train-tag">${char._trainTargets}</span>`
    : '';
  const assignChip = assignment
    ? `<span class="op-assign-chip">${assignment.label}</span>`
    : '';

  card.innerHTML = `
    <div class="op-card-avatar">
      <img src="${getAvatarUrl(char.id)}" alt="${char.name}" loading="lazy" data-mirror="0" ${avatarOnErrorAttr(char.id)}>
      <div class="op-rarity-bar rarity-bar-${char.rarity}"></div>
    </div>
    <div class="op-card-info">
      <div class="op-card-name-row">
        <div class="op-card-name" style="color:${RARITY_COLOR[char.rarity] || '#e8edf5'}">${char.name}</div>
        <span class="op-prof-tag" title="干员职业" style="color:${profStyle.fg};background:${profStyle.bg};border-color:${profStyle.bd}">${profLabel}</span>
        ${eliteBadge}
        ${trainMasteryBadge}
      </div>
      <div class="op-card-skills">${skillTags}${trainTargetBadge}${assignChip}</div>
    </div>
    ${meetScore}${hireScore}${tradeScore}${powerScore}${manuScore}
  `;

  // 拖拽支持
  card.draggable = !assignment; // 已分配的不可拖拽（需先移除）
  card.addEventListener('dragstart', e => {
    if (assignment) { e.preventDefault(); return; }
    dragCharId = char.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', char.id);
  });
  card.addEventListener('dragend', () => {
    dragCharId = null;
    card.classList.remove('dragging');
  });

  // 点击快捷分配
  card.addEventListener('click', () => {
    if (assignment) {
      // 已分配：跳转到对应设施
      selectFacility(assignment.roomType, assignment.roomIdx);
      showToast(`${char.name} 在 ${assignment.label}`, 'info');
    } else {
      // 未分配：如果当前选中了设施，尝试分配
      if (selectedFacility) {
        assignOperatorToRoom(char.id, selectedFacility.roomType, selectedFacility.roomIdx);
      } else {
        showToast('请先点击左侧设施，然后点击干员分配', 'info');
      }
    }
  });

  // Tooltip：对照当前选中设施
  card.addEventListener('mouseenter', e => showOpTooltip(e, char.id, selectedFacility?.roomType || null));
  card.addEventListener('mouseleave', hideTooltip);
  card.addEventListener('mousemove', e => moveTooltip(e));

  return card;
}

// ============================================================
// 分配干员
// ============================================================
function assignOperatorToRoom(charId, roomType, roomIdx) {
  const char = BUILDING_DATA.chars[charId];
  if (!char) return;

  const room = engine.layout[roomType][roomIdx];
  const cap = engine.getRoomCapacity(roomType, room.level);

  // 检查容量
  if (room.operators.length >= cap) {
    showToast(`${ROOM_META[roomType]?.name}已满员`, 'error');
    return;
  }

  // 检查技能匹配（提示但不阻止）
  const hasMatchingSkill = char.skills.some(s => s.roomType === roomType && s.eliteReq <= 2);
  
  const success = engine.assignOperator(charId, roomType, roomIdx);
  if (success) {
    // 搜索找到并放入后，清空右侧搜索框，方便继续找下一位
    if (searchText) {
      searchText = '';
      const searchEl = document.getElementById('opSearch');
      if (searchEl) searchEl.value = '';
    }
    renderFacilities();
    if (selectedFacility) renderDetailPanel();
    renderOperators();
    updateGlobalStats();
    const roomLabel = ROOM_META[roomType]?.name + (engine.layout[roomType].length > 1 ? ` ${roomIdx + 1}` : '');
    if (!hasMatchingSkill) {
      showToast(`${char.name} → ${roomLabel}（无匹配基建技能）`, 'info');
    } else {
      showToast(`${char.name} → ${roomLabel}`, 'success');
    }
  }
}

function handleSlotDrop(e, roomType, roomIdx, slotIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if (dragCharId) {
    assignOperatorToRoom(dragCharId, roomType, roomIdx);
    dragCharId = null;
  }
}
window.handleSlotDrop = handleSlotDrop;

// ============================================================
// Tooltip 逻辑
// ============================================================
function showOpTooltip(e, charId, roomType) {
  const char = BUILDING_DATA.chars[charId];
  if (!char) return;

  const tooltip = document.getElementById('skillTooltip');
  // 有选中设施时：按该设施所需精英展示对应技能；否则用全局默认（精二/孑精0）
  const facilityElite = roomType != null ? getFacilityEliteNeed(char, roomType) : null;
  const viewElite = facilityElite != null ? facilityElite : engine.getPreferredElite(charId);
  const activeSkills = engine.getActiveSkills(charId, viewElite);

  document.getElementById('ttOpName').textContent = char.name;
  const profLabel = getProfessionLabel(char);
  const eliteInfo = formatEliteNeed(facilityElite != null ? facilityElite : engine.getPreferredElite(charId));
  const roomName = roomType ? (ROOM_META[roomType]?.name || roomType) : '';
  document.getElementById('ttElite').textContent = roomType
    ? `${profLabel} · ${roomName}需${eliteInfo?.text || '—'}`
    : `${profLabel} · ${eliteInfo?.text || '—'}`;

  const box = document.getElementById('ttSkills');
  // 优先列出与当前设施相关的技能（含未达完整精英的低级版说明）
  let skillsToShow = activeSkills;
  if (roomType) {
    const roomSkills = activeSkills.filter(s => s.roomType === roomType);
    skillsToShow = roomSkills.length ? roomSkills : activeSkills;
  }

  if (skillsToShow.length === 0) {
    box.innerHTML = `<div class="tooltip-desc">${roomType ? '该设施无对应基建技能' : '无基建技能'}</div>`;
  } else {
    const prio = { MANUFACTURE: 0, TRADING: 1, POWER: 2, CONTROL: 3, DORMITORY: 4, MEETING: 5, HIRE: 6, TRAINING: 7 };
    const sorted = [...skillsToShow].sort((a, b) => {
      const am = roomType && a.roomType === roomType ? 0 : 1;
      const bm = roomType && b.roomType === roomType ? 0 : 1;
      return am - bm || (prio[a.roomType] ?? 9) - (prio[b.roomType] ?? 9) || (a.slotIdx ?? 0) - (b.slotIdx ?? 0);
    });

    const jayNote = char.name === '孑'
      ? (engine.jayElite2
        ? `<div class="tooltip-note">当前：孑精二开 → 摊贩经济 + 市井之道。可在右侧「孑精二」关闭以切回精0。</div>`
        : `<div class="tooltip-note">当前：孑精二关 → 仅精0摊贩经济（推荐）。打开右侧「孑精二」可启用市井之道。</div>`)
      : '';

    box.innerHTML = sorted.map(skill => {
      const match = roomType && skill.roomType === roomType;
      const need = formatEliteNeed(skill.eliteReq);
      const reqText = `解锁：精英${skill.eliteReq}` + (skill.levelReq > 1 ? ` Lv${skill.levelReq}+` : '');
      return `
        <div class="tooltip-skill-block${match || !roomType ? '' : ' dim'}">
          <div class="tooltip-skill-top">
            <span class="tooltip-skill-name">${skill.name || '基建技能'}</span>
            <span class="tooltip-room">${ROOM_META[skill.roomType]?.name || skill.roomType || ''} · ${need?.text || ''}</span>
          </div>
          <div class="tooltip-desc">${skill.desc || '（暂无描述）'}</div>
          <div class="tooltip-req">${reqText}</div>
        </div>`;
    }).join('') + jayNote;
  }

  tooltip.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  const tooltip = document.getElementById('skillTooltip');
  if (tooltip.style.display === 'none') return;
  const x = e.clientX + 16;
  const y = e.clientY - 8;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 32 : x) + 'px';
  tooltip.style.top = (y + th > window.innerHeight ? y - th : y) + 'px';
}

function hideTooltip() {
  document.getElementById('skillTooltip').style.display = 'none';
}

// ============================================================
// 全局数据统计
// ============================================================
function updateGlobalStats() {
  // 制造站平均效率
  const manus = engine.layout.MANUFACTURE.map((_, i) => engine.calcManufacture(i)).filter(Boolean);
  const avgManu = manus.length ? manus.reduce((s, r) => s + r.efficiency, 0) / manus.length : 100;
  document.getElementById('statManuEff').textContent = formatEffRate(avgManu, { signed: false });

  // 贸易站平均效率
  const trades = engine.layout.TRADING.map((_, i) => engine.calcTrading(i)).filter(Boolean);
  const avgTrade = trades.length ? trades.reduce((s, r) => s + r.efficiency, 0) / trades.length : 100;
  document.getElementById('statTradeEff').textContent = formatEffRate(avgTrade - 100, { signed: false });

  // 无人机充能（所有发电站加成之和）
  const powers = engine.layout.POWER.map((_, i) => engine.calcPower(i)).filter(Boolean);
  const totalDrone = powers.reduce((s, r) => s + r.droneRecharge, 0);
  document.getElementById('statDrone').textContent = formatEffRate(totalDrone, { signed: true });

  // 控制中枢心情减免（仍用 /h 心情单位，不是效率倍率）
  const ctrl = engine.calcControl();
  document.getElementById('statMood').textContent = `-${((ctrl.globalMoodReduction || 0)).toFixed(2)}/h`;

  // 电量负荷
  const pw = engine.calcPowerBalance();
  const powerEl = document.getElementById('statPower');
  const chipEl = document.getElementById('powerChip');
  const balance = pw.balance;
  powerEl.textContent = `${pw.generated}/${pw.consumed}`;
  if (balance >= 0) {
    powerEl.className = 'stat-value power-ok';
    chipEl.title = `发电 ${pw.generated} | 耗电 ${pw.consumed} | 剩余 +${balance}`;
  } else {
    powerEl.className = 'stat-value power-over';
    chipEl.title = `发电 ${pw.generated} | 耗电 ${pw.consumed} | 不足 ${balance}（设施停转！）`;
  }

  renderConflictAlerts();
  autoSave();
}

/** 布局互斥 / 条件失效提示条 */
function renderConflictAlerts() {
  let box = document.getElementById('conflictAlerts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'conflictAlerts';
    box.className = 'conflict-alerts';
    const topBar = document.querySelector('.top-bar');
    if (topBar && topBar.parentNode) {
      topBar.parentNode.insertBefore(box, topBar.nextSibling);
    } else {
      document.body.prepend(box);
    }
  }
  const list = (engine.detectLayoutConflicts && engine.detectLayoutConflicts()) || [];
  if (!list.length) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'flex';
  box.innerHTML = list.map(c =>
    `<div class="conflict-item conflict-${c.level}">⚠ ${c.msg}</div>`
  ).join('');
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
  // 设施数量
  ['manuCount', 'tradeCount', 'powerCount', 'dormCount'].forEach(id => {
    const sel = document.getElementById(id);
    const typeMap = { manuCount: 'MANUFACTURE', tradeCount: 'TRADING', powerCount: 'POWER', dormCount: 'DORMITORY' };
    sel.addEventListener('change', () => {
      const roomType = typeMap[id];
      engine.setRoomCount(roomType, parseInt(sel.value));
      if (selectedFacility?.roomType === roomType && selectedFacility.roomIdx >= engine.layout[roomType].length) {
        selectedFacility = null;
        document.getElementById('detailPlaceholder').style.display = '';
        document.getElementById('facilityDetail').style.display = 'none';
      }
      renderFacilities();
      renderOperators();
      updateGlobalStats();
    });
  });

  // 搜索
  document.getElementById('opSearch').addEventListener('input', e => {
    searchText = e.target.value.trim();
    renderOperators();
  });

  // 孑精二开关：关=精0，开=精二（含市井之道）
  const jayTog = document.getElementById('jayElite2Toggle');
  if (jayTog) {
    jayTog.checked = !!engine.jayElite2;
    jayTog.addEventListener('change', () => {
      engine.jayElite2 = jayTog.checked;
      renderAll();
      showToast(engine.jayElite2 ? '孑：精二（市井之道）' : '孑：精0（摊贩经济）', 'info');
    });
  }

  // 设施类型过滤
  document.querySelectorAll('.filter-btn[data-room]').forEach(btn => {
    btn.addEventListener('click', () => {
      const room = btn.dataset.room;
      if (room === 'UNASSIGNED') {
        showUnassigned = !showUnassigned;
        btn.classList.toggle('active', showUnassigned);
      } else {
        filterRoom = room;
        isAutoRoomFilter = false; // 手动点击，执行真实过滤
        showUnassigned = false;
        document.getElementById('btnUnassigned').classList.remove('active');
        document.querySelectorAll('.filter-btn[data-room]').forEach(b => {
          if (b.dataset.room !== 'UNASSIGNED') b.classList.toggle('active', b.dataset.room === room);
        });
      }
      renderOperators();
    });
  });

  // 稀有度过滤
  document.querySelectorAll('.rarity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterRarity = btn.dataset.rarity;
      document.querySelectorAll('.rarity-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderOperators();
    });
  });

  // 保存配置
  document.getElementById('btnSaveConfig').addEventListener('click', () => {
    const name = prompt('请输入配置名称：', `配置 ${new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}`);
    if (name && name.trim()) saveNewConfig(name.trim());
  });

  // 配置列表抽屉
  document.getElementById('btnShowConfigs').addEventListener('click', () => {
    renderConfigList();
    const drawer = document.getElementById('configDrawer');
    drawer.style.display = drawer.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('btnCloseDrawer').addEventListener('click', () => {
    document.getElementById('configDrawer').style.display = 'none';
  });
  document.getElementById('configDrawer').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('configDrawer').style.display = 'none';
  });

  // 导出（含单设施换班）
  document.getElementById('btnExport').addEventListener('click', () => {
    const blob = new Blob([serializeState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arknights-base-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('配置已导出（含换班）', 'success');
  });

  // 导入
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target.result;
      if (deserializeState(raw) || engine.importConfig(raw)) {
        renderAll();
        showToast('配置已导入', 'success');
      } else {
        showToast('导入失败：格式错误', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // 重置
  document.getElementById('btnReset').addEventListener('click', () => {
    showModal('重置确认', '确定要清空所有干员分配吗？此操作不可撤销。', () => {
      engine.reset();
      roomShifts = { version: 5, rooms: {} };
      persistRoomShifts();
      selectedFacility = null;
      document.getElementById('detailPlaceholder').style.display = '';
      document.getElementById('facilityDetail').style.display = 'none';
      renderAll();
      showToast('已重置', 'info');
    });
  });

  // 全局 drag 结束处理
  document.addEventListener('dragend', () => {
    dragCharId = null;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.querySelectorAll('.facility-card').forEach(el => el.style.borderColor = '');
  });
}

// ============================================================
// 弹窗
// ============================================================
let modalCallback = null;
function showModal(title, body, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  document.getElementById('modalOverlay').style.display = 'flex';
  modalCallback = onConfirm;
}

document.getElementById('modalConfirm').addEventListener('click', () => {
  document.getElementById('modalOverlay').style.display = 'none';
  if (modalCallback) { modalCallback(); modalCallback = null; }
});
document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('modalOverlay').style.display = 'none';
  modalCallback = null;
});
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('modalOverlay').style.display = 'none';
    modalCallback = null;
  }
});

// ============================================================
// 全量渲染
// ============================================================
function renderAll() {
  renderFacilities();
  renderOperators();
  updateGlobalStats(); // 内含 autoSave
  if (selectedFacility) renderDetailPanel();
}

// ============================================================
// 单设施独立换班 A/B/C
// - 每个设施各自存组，互不共用
// - 同人可同时存在 A/B/C 多个分组里
// - 换班：目标组有人被其它设施占用 → 提示冲突原因，并自动试下一组
// ============================================================
const ROOM_SHIFTS_KEY = 'ak_base_room_shifts';
const SHIFT_SETS = ['A', 'B', 'C'];
/**
 * @type {{
 *   version: 5,
 *   rooms: Record<string, { active: 'A'|'B'|'C', A: string[], B: string[], C: string[] }>
 * }}
 */
let roomShifts = { version: 5, rooms: {} };

function shiftRoomKey(roomType, roomIdx) {
  return `${roomType}:${roomIdx}`;
}

function emptyRoomShiftData() {
  return { active: 'A', A: [], B: [], C: [] };
}

function ensureShiftShape() {
  if (!roomShifts || typeof roomShifts !== 'object') {
    roomShifts = { version: 5, rooms: {} };
  }
  if (!roomShifts.rooms || typeof roomShifts.rooms !== 'object') roomShifts.rooms = {};
  roomShifts.version = 5;
}

/** 旧版 → v5 每站独立；同人可进多组 */
function migrateRoomShiftsIfNeeded(raw) {
  if (!raw || typeof raw !== 'object') return { version: 5, rooms: {} };

  if (raw.version === 5 && raw.rooms) {
    for (const d of Object.values(raw.rooms)) {
      if (!d || typeof d !== 'object') continue;
      for (const s of SHIFT_SETS) {
        if (!Array.isArray(d[s])) d[s] = [];
      }
      if (!SHIFT_SETS.includes(d.active)) d.active = 'A';
    }
    return raw;
  }

  const next = { version: 5, rooms: {} };

  // v3 已是 per-room
  if (raw.version === 3 && raw.rooms) {
    for (const [k, d] of Object.entries(raw.rooms)) {
      if (!d || typeof d !== 'object') continue;
      if (!/^([A-Z_]+):\d+$/.test(k)) continue;
      const room = emptyRoomShiftData();
      for (const s of SHIFT_SETS) {
        room[s] = Array.isArray(d[s]) ? d[s].filter(Boolean).slice() : [];
      }
      room.active = SHIFT_SETS.includes(d.active) ? d.active : 'A';
      next.rooms[k] = room;
    }
    return next;
  }

  // v2/v4 共用池 → 复制到各站（之后各自独立改）
  if ((raw.version === 2 || raw.version === 4) && raw.pools) {
    const actives = raw.active && typeof raw.active === 'object' ? raw.active : {};
    for (const [roomType, pool] of Object.entries(raw.pools)) {
      if (!pool || typeof pool !== 'object') continue;
      let keys = Object.keys(actives).filter(k => k.startsWith(`${roomType}:`));
      // 按当前布局房间数补齐
      const nRooms = (typeof engine !== 'undefined' && engine.layout?.[roomType]?.length) || 0;
      for (let i = 0; i < nRooms; i++) {
        const k = `${roomType}:${i}`;
        if (!keys.includes(k)) keys.push(k);
      }
      if (!keys.length) keys = [`${roomType}:0`];
      for (const k of keys) {
        const room = emptyRoomShiftData();
        for (const s of SHIFT_SETS) {
          room[s] = Array.isArray(pool[s]) ? pool[s].filter(Boolean).slice() : [];
        }
        room.active = SHIFT_SETS.includes(actives[k]) ? actives[k] : 'A';
        next.rooms[k] = room;
      }
    }
    return next;
  }

  // v1
  for (const [k, d] of Object.entries(raw)) {
    if (!d || typeof d !== 'object' || k === 'version' || k === 'pools' || k === 'active' || k === 'rooms') continue;
    if (!/^([A-Z_]+):\d+$/.test(k)) continue;
    const room = emptyRoomShiftData();
    for (const s of SHIFT_SETS) {
      room[s] = Array.isArray(d[s]) ? d[s].filter(Boolean).slice() : [];
    }
    room.active = SHIFT_SETS.includes(d.active) ? d.active : 'A';
    next.rooms[k] = room;
  }
  return next;
}

function loadRoomShiftsFromStorage() {
  try {
    const raw = localStorage.getItem(ROOM_SHIFTS_KEY);
    roomShifts = migrateRoomShiftsIfNeeded(raw ? JSON.parse(raw) : null);
    ensureShiftShape();
  } catch (e) {
    roomShifts = { version: 5, rooms: {} };
  }
}

function persistRoomShifts() {
  try {
    ensureShiftShape();
    localStorage.setItem(ROOM_SHIFTS_KEY, JSON.stringify(roomShifts));
  } catch (e) {
    console.warn('[roomShifts] persist failed', e);
  }
}

function getRoomShiftData(roomType, roomIdx) {
  ensureShiftShape();
  const k = shiftRoomKey(roomType, roomIdx);
  if (!roomShifts.rooms[k]) roomShifts.rooms[k] = emptyRoomShiftData();
  const d = roomShifts.rooms[k];
  for (const s of SHIFT_SETS) {
    if (!Array.isArray(d[s])) d[s] = [];
  }
  if (!SHIFT_SETS.includes(d.active)) d.active = 'A';
  return d;
}

function getRoomActiveShift(roomType, roomIdx) {
  return getRoomShiftData(roomType, roomIdx).active;
}

function setRoomActiveShift(roomType, roomIdx, which) {
  getRoomShiftData(roomType, roomIdx).active = which;
}

/** 某组干员是否被「其它设施」占用（宿舍/本站/未进驻不算冲突） */
function getShiftGroupConflicts(roomType, roomIdx, idList) {
  const conflicts = [];
  for (const id of (idList || []).filter(Boolean)) {
    const loc = engine.isOperatorAssigned(id);
    if (!loc) continue;
    if (loc.roomType === 'DORMITORY') continue;
    if (loc.roomType === roomType && loc.roomIdx === roomIdx) continue;
    const name = BUILDING_DATA.chars[id]?.name || id;
    const where = `${ROOM_META[loc.roomType]?.name || loc.roomType}${
      (engine.layout[loc.roomType] || []).length > 1 ? loc.roomIdx + 1 : ''
    }`;
    conflicts.push({ id, name, where, roomType: loc.roomType, roomIdx: loc.roomIdx });
  }
  return conflicts;
}

/**
 * 从当前班起找下一可换组：
 * - 须已存人
 * - 无人被其它设施占用（宿舍/本站/未进驻不算）
 * - 设施为空时：允许拉回「当前已存班」（只存 1 组也能上人）
 * 返回 { next, skipped: [{ set, reasons }] }
 */
function findNextAvailableShift(roomType, roomIdx) {
  const data = getRoomShiftData(roomType, roomIdx);
  const cur = data.active;
  const curIdx = Math.max(0, SHIFT_SETS.indexOf(cur));
  const roomOps = (engine.layout[roomType]?.[roomIdx]?.operators || []).filter(Boolean);
  const roomEmpty = roomOps.length === 0;
  const skipped = [];

  for (let step = 1; step <= SHIFT_SETS.length; step++) {
    const next = SHIFT_SETS[(curIdx + step) % SHIFT_SETS.length];
    // 正常换班跳过当前班；设施空着时允许把当前已存班重新拉上来
    if (next === cur && !roomEmpty) continue;

    const list = (data[next] || []).filter(Boolean);
    if (!list.length) {
      skipped.push({ set: next, reasons: ['未存人'] });
      continue;
    }
    const conflicts = getShiftGroupConflicts(roomType, roomIdx, list);
    if (conflicts.length) {
      skipped.push({
        set: next,
        reasons: conflicts.map(c => `${c.name}在${c.where}`),
      });
      continue;
    }
    return { next, skipped, restored: next === cur && roomEmpty };
  }
  return { next: null, skipped, restored: false };
}

function getRoomShiftHoursText(roomType, roomIdx, stats) {
  const ops = (engine.layout[roomType]?.[roomIdx]?.operators || []).filter(Boolean);
  if (!ops.length) return '—';
  let minH = Infinity;
  for (const id of ops) {
    const mood = engine.getOperatorMood(id);
    const drain = (stats?.operatorMoodDrains && stats.operatorMoodDrains[id] != null)
      ? stats.operatorMoodDrains[id]
      : (stats?.moodCost != null ? stats.moodCost : 1);
    if (drain <= 0.001) continue;
    minH = Math.min(minH, mood / drain);
  }
  if (!isFinite(minH)) return '∞';
  return minH >= 100 ? '99+' : minH.toFixed(1);
}

function shiftSetTipHtml(which, list, { isDel = false } = {}) {
  const n = list.length;
  const names = list.map(id => BUILDING_DATA.chars[id]?.name || id);
  const head = isDel
    ? (n ? `清空本站 ${which}班` : `${which}班为空`)
    : (n ? `本站 ${which}班 · ${n} 人` : `本站 ${which}班为空`);
  const sub = isDel
    ? (n ? '不影响当前进驻' : '无需删除')
    : (n ? '可与其它组重复干员；换班时再判冲突' : `点击把当前进驻存为 ${which}班`);
  const body = n
    ? `<div class="shift-tip-names">${names.map(nm => `<span class="shift-tip-chip">${nm}</span>`).join('')}</div>`
    : `<div class="shift-tip-empty">暂无干员</div>`;
  return `<div class="shift-tip-head">${head}</div><div class="shift-tip-sub">${sub}</div>${body}`;
}

function ensureShiftHoverTip() {
  let tip = document.getElementById('shiftHoverTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'shiftHoverTip';
    tip.className = 'shift-hover-tip';
    tip.style.display = 'none';
    document.body.appendChild(tip);
  }
  return tip;
}

function showShiftHoverTip(clientX, clientY, html) {
  const tip = ensureShiftHoverTip();
  tip.innerHTML = html;
  tip.style.display = 'block';
  const pad = 12;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  let left = clientX + 14;
  let top = clientY + 14;
  if (left + tw > window.innerWidth - pad) left = clientX - tw - 14;
  if (top + th > window.innerHeight - pad) top = clientY - th - 10;
  tip.style.left = `${Math.max(pad, left)}px`;
  tip.style.top = `${Math.max(pad, top)}px`;
}

function hideShiftHoverTip() {
  const tip = document.getElementById('shiftHoverTip');
  if (tip) tip.style.display = 'none';
}

function buildRoomShiftBarHtml(roomType, roomIdx, stats) {
  // 宿舍只做休息缓冲，不提供存班/换班
  if (roomType === 'DORMITORY') return '';
  const data = getRoomShiftData(roomType, roomIdx);
  const active = data.active;
  const hours = getRoomShiftHoursText(roomType, roomIdx, stats);
  const saveBtns = SHIFT_SETS.map(s => {
    const list = (data[s] || []).filter(Boolean);
    const n = list.length;
    const delDis = n ? '' : ' disabled';
    return `<span class="room-shift-set">
      <button type="button" class="room-shift-btn" data-shift-save="${s}" data-shift-tip="save">存${s}${n ? `(${n})` : ''}</button>
      <button type="button" class="room-shift-btn room-shift-btn-del" data-shift-clear="${s}" data-shift-tip="del"${delDis}>删${s}</button>
    </span>`;
  }).join('');
  return `
    <div class="room-shift-bar" data-room-type="${roomType}" data-room-idx="${roomIdx}">
      <span class="room-shift-badge">当前 ${active}班</span>
      <span class="room-shift-hours">还可约 ${hours}h</span>
      ${saveBtns}
      <button type="button" class="room-shift-btn room-shift-btn-swap" data-shift-swap>换班</button>
    </div>`;
}

function saveSelectedRoomShift(which) {
  if (!selectedFacility) return;
  if (selectedFacility.roomType === 'DORMITORY') return;
  if (!SHIFT_SETS.includes(which)) return;
  const { roomType, roomIdx } = selectedFacility;
  const room = engine.layout[roomType]?.[roomIdx];
  if (!room) return;
  const data = getRoomShiftData(roomType, roomIdx);
  // 允许同人进 A/B/C 多组，不做组间互斥
  data[which] = room.operators.filter(Boolean).slice();
  data.active = which;
  persistRoomShifts();
  autoSave();
  const label = `${ROOM_META[roomType]?.name || roomType}${engine.layout[roomType].length > 1 ? roomIdx + 1 : ''}`;
  showToast(`${label}：已存本站 ${which}班（${data[which].length} 人）· 已自动存档`, 'success');
  renderDetailPanel();
}

function clearSelectedRoomShift(which) {
  if (!selectedFacility) return;
  if (selectedFacility.roomType === 'DORMITORY') return;
  if (!SHIFT_SETS.includes(which)) return;
  const { roomType, roomIdx } = selectedFacility;
  const data = getRoomShiftData(roomType, roomIdx);
  const n = (data[which] || []).filter(Boolean).length;
  if (!n) {
    showToast(`${which}班本来就是空的`, 'info');
    return;
  }
  data[which] = [];
  persistRoomShifts();
  autoSave();
  const label = `${ROOM_META[roomType]?.name || roomType}${engine.layout[roomType].length > 1 ? roomIdx + 1 : ''}`;
  showToast(`${label}：已删本站 ${which}班（${n} 人）；当前进驻未动`, 'success');
  renderDetailPanel();
}

function swapSelectedRoomShift() {
  if (!selectedFacility) return;
  if (selectedFacility.roomType === 'DORMITORY') return;
  const { roomType, roomIdx } = selectedFacility;
  const room = engine.layout[roomType]?.[roomIdx];
  if (!room) return;
  const data = getRoomShiftData(roomType, roomIdx);
  const cur = data.active;
  const { next, skipped, restored } = findNextAvailableShift(roomType, roomIdx);

  // 先把跳过的冲突说清楚
  const conflictSkips = (skipped || []).filter(s => s.reasons?.some(r => !r.includes('未存人')));
  if (conflictSkips.length) {
    const detail = conflictSkips
      .map(s => `${s.set}班：${s.reasons.join('、')}`)
      .join('；');
    showToast(`换班冲突（已跳过）：${detail}`, 'error', 6500);
  }

  if (!next) {
    const empty = (skipped || []).filter(s => s.reasons?.includes('未存人')).map(s => s.set);
    const stored = SHIFT_SETS.filter(s => (data[s] || []).filter(Boolean).length);
    if (stored.length <= 1 && (room.operators || []).filter(Boolean).length) {
      showToast(stored.length ? `仅存 ${stored[0]}班，设施已有人，无法换班` : '请先存班再换班', 'error', 4500);
    } else if (empty.length && !conflictSkips.length) {
      showToast(`请先「存${empty.join('/')}」再换班`, 'error', 4500);
    } else if (!conflictSkips.length) {
      showToast('没有可切换的班次', 'error', 4000);
    } else {
      showToast('冲突组已跳过，也没有其它可用组', 'error', 5000);
    }
    return;
  }

  // 先拷贝替班名单，再写回下班（避免「空设施拉回同组」时把存班冲掉）
  const nextList = (data[next] || []).filter(Boolean).slice();
  const outgoing = room.operators.filter(Boolean).slice();
  if (!(restored && next === cur && !outgoing.length)) {
    data[cur] = outgoing.slice();
  }

  const vacatedDormIdx = [];
  for (const id of nextList) {
    const loc = engine.isOperatorAssigned(id);
    if (loc && loc.roomType === 'DORMITORY') vacatedDormIdx.push(loc.roomIdx);
  }

  for (const id of nextList) engine.removeOperator(id);
  for (const id of outgoing) engine.removeOperator(id);

  const cap = engine.getRoomCapacity(roomType, room.level);
  let placedIn = 0;
  for (const id of nextList.slice(0, cap)) {
    if (engine.assignOperator(id, roomType, roomIdx)) placedIn++;
  }
  if (!placedIn) {
    for (const id of outgoing.slice(0, cap)) engine.assignOperator(id, roomType, roomIdx);
    // 拉回失败时尽量恢复被误清空的存班
    if (nextList.length && !(data[next] || []).filter(Boolean).length) {
      data[next] = nextList.slice();
    }
    showToast('换班失败：替班无法进驻', 'error', 4500);
    return;
  }

  let dormPtr = 0;
  const notPlaced = [];
  for (const id of outgoing) {
    if (nextList.includes(id)) continue;
    let placed = false;
    while (dormPtr < vacatedDormIdx.length && !placed) {
      placed = !!engine.assignOperator(id, 'DORMITORY', vacatedDormIdx[dormPtr++]);
    }
    if (!placed) {
      for (let i = 0; i < (engine.layout.DORMITORY || []).length; i++) {
        if (engine.assignOperator(id, 'DORMITORY', i)) { placed = true; break; }
      }
    }
    if (!placed) notPlaced.push(BUILDING_DATA.chars[id]?.name || id);
  }

  data.active = next;
  data[next] = (engine.layout[roomType][roomIdx].operators || []).filter(Boolean).slice();
  persistRoomShifts();
  autoSave();

  const label = `${ROOM_META[roomType]?.name || roomType}${engine.layout[roomType].length > 1 ? roomIdx + 1 : ''}`;
  const skipNote = conflictSkips.length
    ? `（已跳过冲突的 ${conflictSkips.map(s => s.set).join('/')}）`
    : '';
  let msg = restored
    ? `${label}：空设施已拉回 ${next}班${skipNote}`
    : `${label}：${cur}班 → ${next}班${skipNote}`;
  if (notPlaced.length) msg += `；未塞进宿舍：${notPlaced.join('、')}`;
  showToast(msg, notPlaced.length ? 'info' : 'success', 4500);
  renderFacilities();
  renderDetailPanel();
  renderOperators();
  updateGlobalStats();
}

function bindRoomShiftBarEvents(detailRoot) {
  const bar = detailRoot?.querySelector('.room-shift-bar');
  if (!bar) return;
  const roomType = bar.getAttribute('data-room-type');
  const roomIdx = parseInt(bar.getAttribute('data-room-idx'), 10) || 0;

  bar.querySelectorAll('[data-shift-save]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      hideShiftHoverTip();
      saveSelectedRoomShift(btn.getAttribute('data-shift-save'));
    });
  });
  bar.querySelectorAll('[data-shift-clear]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      hideShiftHoverTip();
      clearSelectedRoomShift(btn.getAttribute('data-shift-clear'));
    });
  });
  bar.querySelector('[data-shift-swap]')?.addEventListener('click', e => {
    e.stopPropagation();
    hideShiftHoverTip();
    swapSelectedRoomShift();
  });

  bar.querySelectorAll('[data-shift-tip]').forEach(btn => {
    const show = (e) => {
      const which = btn.getAttribute('data-shift-save') || btn.getAttribute('data-shift-clear');
      if (!which) return;
      const data = getRoomShiftData(roomType, roomIdx);
      const list = (data[which] || []).filter(Boolean);
      const html = shiftSetTipHtml(which, list, {
        isDel: btn.getAttribute('data-shift-tip') === 'del',
      });
      showShiftHoverTip(e.clientX, e.clientY, html);
    };
    btn.addEventListener('mouseenter', show);
    btn.addEventListener('mousemove', show);
    btn.addEventListener('mouseleave', hideShiftHoverTip);
  });
}

loadRoomShiftsFromStorage();

// ============================================================
// 配置管理 - localStorage 保存 / 加载
// ============================================================
const CONFIG_STORAGE_KEY = 'ak_base_configs';
const CONFIG_AUTO_KEY    = 'ak_base_autosave';
const CONFIG_AUTO_TIME   = 'ak_base_autosave_time';

function serializeState() {
  return JSON.stringify({
    layout: engine.layout,
    moods: engine.moods,
    jayElite2: !!engine.jayElite2,
    roomShifts,
    savedAt: Date.now(),
  });
}

function deserializeState(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const { layout, moods, jayElite2, roomShifts: savedShifts } = data || {};
    if (!layout?.CONTROL || !Array.isArray(layout.CONTROL)) return false;

    // 深拷贝，并补齐缺省设施键（兼容旧存档）
    const next = JSON.parse(JSON.stringify(layout));
    const skeleton = new BaseEngine().layout;
    for (const key of Object.keys(skeleton)) {
      if (!Array.isArray(next[key]) || !next[key].length) {
        next[key] = JSON.parse(JSON.stringify(skeleton[key]));
      }
    }
    engine.layout = next;
    engine.moods = moods && typeof moods === 'object' ? { ...moods } : {};
    engine.jayElite2 = !!jayElite2;
    if (savedShifts && typeof savedShifts === 'object') {
      roomShifts = migrateRoomShiftsIfNeeded(savedShifts);
      ensureShiftShape();
      persistRoomShifts();
    }
    const tog = document.getElementById('jayElite2Toggle');
    if (tog) tog.checked = engine.jayElite2;
    return true;
  } catch (e) {
    console.warn('[autosave] restore failed', e);
    return false;
  }
}

// 自动记忆：任意改动后 debounce 写入（进驻/移除/改等级等都走 updateGlobalStats）
let _autoSaveTimer = null;
let _autoSaveSilent = false;
function autoSave(immediate = false) {
  const write = () => {
    try {
      const payload = serializeState();
      localStorage.setItem(CONFIG_AUTO_KEY, payload);
      localStorage.setItem(CONFIG_AUTO_TIME, new Date().toLocaleString());
    } catch (e) {
      console.warn('[autosave] write failed', e);
      if (!_autoSaveSilent) {
        _autoSaveSilent = true;
        showToast('自动保存失败（浏览器存储可能已满）', 'error', 4000);
      }
    }
  };
  if (immediate) {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = null;
    write();
    return;
  }
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(write, 150);
}

// 保存为新配置
function saveNewConfig(name) {
  const configs = loadAllConfigs();
  configs.push({ id: Date.now(), name, data: serializeState(), time: new Date().toLocaleString() });
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs));
  renderConfigList();
  showToast(`已保存「${name}」`, 'success');
}

function loadAllConfigs() {
  try { return JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '[]'); } catch(e) { return []; }
}

function loadConfig(id) {
  const configs = loadAllConfigs();
  const cfg = configs.find(c => c.id === id);
  if (!cfg) return;
  if (deserializeState(cfg.data)) {
    selectedFacility = null;
    document.getElementById('detailPlaceholder').style.display = '';
    document.getElementById('facilityDetail').style.display = 'none';
    renderAll();
    showToast(`已加载「${cfg.name}」`, 'success');
  }
}

function deleteConfig(id) {
  let configs = loadAllConfigs();
  configs = configs.filter(c => c.id !== id);
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs));
  renderConfigList();
}

function renderConfigList() {
  const container = document.getElementById('configList');
  const configs = loadAllConfigs();

  // 自动记忆条
  const autoRaw = localStorage.getItem(CONFIG_AUTO_KEY);
  const autoTime = localStorage.getItem(CONFIG_AUTO_TIME) || '实时同步';
  let autoHtml = '';
  if (autoRaw) {
    autoHtml = `
      <div class="config-item auto-item">
        <div class="config-item-info">
          <span class="config-item-name">⚡ 自动记忆</span>
          <span class="config-item-time">${autoTime}</span>
        </div>
        <div class="config-item-actions">
          <button class="config-btn config-btn-load" onclick="loadAutoSave()">&#9654; 加载</button>
        </div>
      </div>`;
  }

  const savedHtml = configs.length === 0 ? '<div class="config-empty">还没有保存任何配置</div>' :
    configs.slice().reverse().map(cfg => `
      <div class="config-item" data-id="${cfg.id}">
        <div class="config-item-info">
          <span class="config-item-name">${cfg.name}</span>
          <span class="config-item-time">${cfg.time}</span>
        </div>
        <div class="config-item-actions">
          <button class="config-btn config-btn-load" onclick="loadConfig(${cfg.id})">&#9654; 加载</button>
          <button class="config-btn config-btn-del" onclick="deleteConfig(${cfg.id})">&#128465;</button>
        </div>
      </div>`).join('');

  container.innerHTML = autoHtml + savedHtml;
}

window.loadConfig = loadConfig;
window.deleteConfig = deleteConfig;
window.loadAutoSave = function() {
  const raw = localStorage.getItem(CONFIG_AUTO_KEY);
  if (!raw) return;
  if (deserializeState(raw)) {
    selectedFacility = null;
    document.getElementById('detailPlaceholder').style.display = '';
    document.getElementById('facilityDetail').style.display = 'none';
    renderAll();
    showToast('已加载自动记忆', 'success');
  }
};

// ============================================================
// 初始化
// ============================================================
function init() {
  bindEvents();
  // 尝试自动恢复上次记忆的状态
  const autoRaw = localStorage.getItem(CONFIG_AUTO_KEY);
  let restored = false;
  if (autoRaw) {
    restored = deserializeState(autoRaw);
  }
  renderAll();
  // 关页前再刷一次，避免 debounce 未落盘
  window.addEventListener('beforeunload', () => autoSave(true));
  window.addEventListener('pagehide', () => autoSave(true));
  if (restored) {
    const t = localStorage.getItem(CONFIG_AUTO_TIME);
    showToast(t ? `已恢复自动记忆（${t}）` : '已恢复自动记忆', 'info', 2500);
  }
  initWelcomeModal();
  console.log(`[基建模拟器] 加载完成 - ${Object.keys(BUILDING_DATA.chars).length} 名干员`);
}

const WELCOME_HIDE_KEY = 'ak_welcome_hide_day';

function shouldShowWelcomeModal() {
  try {
    const day = localStorage.getItem(WELCOME_HIDE_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (day === today) return false;
  } catch (e) {}
  return true;
}

function hideWelcomeModal({ rememberToday = false } = {}) {
  const overlay = document.getElementById('welcomeOverlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
  if (rememberToday) {
    try {
      localStorage.setItem(WELCOME_HIDE_KEY, new Date().toISOString().slice(0, 10));
    } catch (e) {}
  }
}

function showWelcomeModal() {
  const overlay = document.getElementById('welcomeOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  const cb = document.getElementById('welcomeHideToday');
  if (cb) cb.checked = false;
}

function initWelcomeModal() {
  const overlay = document.getElementById('welcomeOverlay');
  if (!overlay) return;

  const dismiss = () => {
    const hideToday = !!document.getElementById('welcomeHideToday')?.checked;
    hideWelcomeModal({ rememberToday: hideToday });
  };

  document.getElementById('welcomeClose')?.addEventListener('click', dismiss);
  document.getElementById('welcomeDismiss')?.addEventListener('click', dismiss);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) dismiss();
  });
  document.getElementById('btnAuthor')?.addEventListener('click', () => showWelcomeModal());

  if (shouldShowWelcomeModal()) {
    // 稍晚弹出，避免挡住首屏恢复提示
    setTimeout(() => showWelcomeModal(), 400);
  }
}

// DOM 加载完毕后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

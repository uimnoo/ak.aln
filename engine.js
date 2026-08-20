// ============================================================
// 明日方舟基建模拟器 - 计算引擎 v2
// efficiency字段: 贸易/制造/发电=百分比%, 宿舍=心情/h, 负数=消耗
// ============================================================

class BaseEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.layout = {
      CONTROL:     [{ level: 5, operators: [] }],
      MANUFACTURE: [
        { level: 3, operators: [], product: 'GOLD' },
        { level: 3, operators: [], product: 'GOLD' },
        { level: 3, operators: [], product: 'GOLD' },
        { level: 3, operators: [], product: 'GOLD' },
      ],
      TRADING:     [
        { level: 3, operators: [], product: 'GOLD' },
        { level: 3, operators: [], product: 'GOLD' },
      ],
      POWER:       [
        { level: 3, operators: [] },
        { level: 3, operators: [] },
        { level: 3, operators: [] },
      ],
      DORMITORY:   [
        { level: 5, operators: [] },
        { level: 5, operators: [] },
        { level: 5, operators: [] },
        { level: 5, operators: [] },
      ],
      HIRE:        [{ level: 3, operators: [] }],
      TRAINING:    [{ level: 3, operators: [] }],
      MEETING:     [{ level: 3, operators: [] }],
    };
    this.defaultElite = 2;
    // 孑：默认精0（关）；打开后按精二（实际为精一「市井之道」+精0）
    this.jayElite2 = false;
    // 心情状态（默认都是24）
    this.moods = {};
  }

  // 获取干员心情
  getOperatorMood(charId) {
    return this.moods[charId] !== undefined ? this.moods[charId] : 24.0;
  }

  // 设置干员心情
  setOperatorMood(charId, mood) {
    this.moods[charId] = Math.max(0, Math.min(24, parseFloat(mood)));
  }

  // 设施容量
  getRoomCapacity(roomType, level) {
    const caps = {
      CONTROL:     [1, 2, 3, 4, 5],
      MANUFACTURE: [1, 2, 3],
      TRADING:     [1, 2, 3],
      POWER:       [1, 1, 1],
      DORMITORY:   [5, 5, 5, 5, 5],
      HIRE:        [1, 1, 1],
      TRAINING:    [2, 2, 2],
      MEETING:     [1, 2, 2],
    };
    const arr = caps[roomType] || [1];
    return arr[Math.min(level - 1, arr.length - 1)];
  }

  // 杜林族（鸿雪际崖居民计数；鸿雪自身也算杜林）
  static DURIN_OPERATORS = ['杜林', '桃金娘', '褐果', '至简', '特克诺', '鸿雪'];

  // 获取正在工作的杜林族干员数量（包括宿舍，排除未分配）
  getWorkingDurinCount() {
    let count = 0;
    for (const roomType in this.layout) {
      for (const room of this.layout[roomType]) {
        for (const id of room.operators) {
          if (!id) continue;
          const name = BUILDING_DATA.chars[id]?.name;
          if (BaseEngine.DURIN_OPERATORS.includes(name)) count++;
        }
      }
    }
    return count;
  }

  /**
   * 鸿雪/图耶/绮良 赤金线
   * - 绮良只吃「制造站赤金线」，不吃鸿雪杜林线（避免虚高到 12 线）
   * - 吃线看站位：顶配「绮良→图耶→鸿雪」（左→右）；一键会按此排序
   *   · 图耶吃绮良加线：绮良排在图耶前
   *   · 鸿雪吃绮良加线：绮良、图耶都排在鸿雪前
   * - 杜林线：本站有鸿雪「际崖居民」时，全基建杜林族（含鸿雪）上限 4
   * 顶配双赤金+4杜林精二：线8 → 鸿雪40+图耶65+绮良5=110（+人数/中枢另计）
   */
  calcGoldLineTeam(ops, buffEffects) {
    const manuGold = (this.layout.MANUFACTURE || [])
      .filter(r => (r.product || 'GOLD') === 'GOLD').length;
    const nameList = (ops || []).map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    const idx = (n) => nameList.indexOf(n);
    const iK = idx('绮良');
    const iH = idx('鸿雪');
    const iT = idx('图耶');
    const hasH = iH >= 0;
    const hasT = iT >= 0;
    const hasK = iK >= 0;

    const effects = buffEffects || [];
    const hasDurinSkill = effects.some(e => e.skill.buffId === 'trade_ord_line_durin[010]');
    const tuyereBid = effects.find(e =>
      e.skill.buffId === 'trade_ord_spd&gold[000]' || e.skill.buffId === 'trade_ord_spd&gold[010]'
    )?.skill.buffId;
    const kiraraBid = effects.find(e =>
      (e.skill.buffId || '').startsWith('trade_ord_line_gold')
    )?.skill.buffId;

    const durinLines = (hasH && hasDurinSkill)
      ? Math.min(4, this.getWorkingDurinCount())
      : 0;
    const tDiv = tuyereBid === 'trade_ord_spd&gold[010]' ? 2 : 4;
    const kDiv = kiraraBid === 'trade_ord_line_gold[010]' ? 2 : 4;
    const kiraraExtra = (hasK && kiraraBid) ? Math.floor(manuGold / kDiv) * 2 : 0;

    const tGetsKirara = hasK && hasT && iK < iT;
    const hGetsKirara = hasK && hasH && hasT && iK < iT && iT < iH;
    const orderOk = !hasK || !hasT || !hasH || (iK < iT && iT < iH);

    const baseLines = manuGold + durinLines;
    const hLines = hasH ? baseLines + (hGetsKirara ? kiraraExtra : 0) : 0;
    const tLines = hasT ? baseLines + (tGetsKirara ? kiraraExtra : 0) : 0;

    return {
      manuGold,
      durinLines,
      kiraraExtra,
      hLines,
      tLines,
      tDiv,
      kDiv,
      tGetsKirara,
      hGetsKirara,
      orderOk,
      hEff: hasH ? hLines * 5 : 0,
      tEff: hasT && tuyereBid ? (5 + Math.floor(tLines / tDiv) * 15) : 0,
      kEff: hasK && kiraraBid ? 5 : 0,
      orderNote: orderOk
        ? `站序顶配；线 鸿雪${hLines}/图耶${tLines}`
        : `站序非顶配（要：绮良→图耶→鸿雪）；线 鸿雪${hLines}/图耶${tLines}`,
    };
  }

  // 默认精二；孑由 jayElite2 开关控制（关=精0，开=精二）
  getPreferredElite(charId) {
    const name = BUILDING_DATA.chars[charId]?.name;
    if (name === '孑') return this.jayElite2 ? 2 : 0;
    return this.defaultElite ?? 2;
  }

  // --- 会客室进驻隐藏加成（PRTS，各干员各算一份后加算）---
  // 稀有度：6★+5% / 5★+4% / 4★+2% / ≤3★+0%
  // 精英：精二+16% / 精一+8% / 精0+0%
  // 非涣散：+5%（本模拟默认始终生效）
  // 会客室等级：Lv1+7% / Lv2+9% / Lv3+11%（全室共享一项）
  static MEETING_RARITY_BONUS = { 6: 5, 5: 4, 4: 2 };
  static MEETING_ELITE_BONUS = { 0: 0, 1: 8, 2: 16 };
  static MEETING_LEVEL_BONUS = { 1: 7, 2: 9, 3: 11 };
  static MEETING_FOCUS_BONUS = 5;

  getMeetingRarityBonus(rarity) {
    return BaseEngine.MEETING_RARITY_BONUS[rarity] || 0;
  }

  getMeetingEliteBonus(eliteLevel) {
    return BaseEngine.MEETING_ELITE_BONUS[eliteLevel] ?? 0;
  }

  getMeetingLevelBonus(level) {
    return BaseEngine.MEETING_LEVEL_BONUS[level] || 0;
  }

  /** 单干员会客室「进驻隐藏加成」= 稀有度 + 精英 + 非涣散 */
  getMeetingOperatorBaseBonus(charId, eliteLevel = null) {
    const char = BUILDING_DATA.chars[charId];
    if (!char) return 0;
    const elite = eliteLevel != null ? eliteLevel : this.getPreferredElite(charId);
    return this.getMeetingRarityBonus(char.rarity)
      + this.getMeetingEliteBonus(elite)
      + BaseEngine.MEETING_FOCUS_BONUS;
  }

  // 获取指定精英等级及以下生效的技能（同槽取最高精英/等级）
  getActiveSkills(charId, eliteLevel = null) {
    const char = BUILDING_DATA.chars[charId];
    if (!char) return [];
    if (eliteLevel == null) eliteLevel = this.getPreferredElite(charId);

    const activeSkills = {};
    for (const skill of char.skills) {
      if (skill.eliteReq > eliteLevel) continue;
      const prev = activeSkills[skill.slotIdx];
      if (!prev
          || skill.eliteReq > prev.eliteReq
          || (skill.eliteReq === prev.eliteReq && (skill.levelReq || 0) > (prev.levelReq || 0))) {
        activeSkills[skill.slotIdx] = skill;
      }
    }
    return Object.values(activeSkills);
  }

  // 控制中枢全局心情减免 (每人-0.05/h)
  getControlMoodReduction() {
    return this.layout.CONTROL[0].operators.length * 0.05;
  }

  // 基础心情消耗（未含个人技能）：1.0 − 中枢减免 − 进驻人数减免
  calcMoodCost(roomType, operatorCount) {
    const ctrlBonus = this.getControlMoodReduction();
    let cost = 1.0 - ctrlBonus;
    // 制造/贸易：2人-0.05，3人-0.1
    if (roomType === 'MANUFACTURE' || roomType === 'TRADING') {
      if (operatorCount >= 3) cost -= 0.1;
      else if (operatorCount >= 2) cost -= 0.05;
    }
    return cost;
  }

  /**
   * 心情技能分类：
   * - recover: 恢复（不是消耗）
   * - all: 全设施干员消耗
   * - self: 仅自身消耗
   * - none: 无关
   */
  classifyMoodSkill(skill) {
    const d = skill.desc || '';
    const mc = typeof skill.moodCost === 'number' ? skill.moodCost : 0;
    // 全体恢复（彩虹等）— 与消耗分开
    if (/控制中枢内所有干员的心情每小时恢复|所有干员的心情每小时恢复/.test(d)) return 'recover_all';
    if (/心情每小时恢复|心情恢复/.test(d) && !/消耗/.test(d)) return 'recover';
    // 全体消耗（低语等；改写后的 desc 仍含「全体」）
    if (/全体|所有干员.*消耗|控制中枢内所有干员的心情每小时消耗/.test(d)) return 'all';
    if (/自身心情每小时消耗/.test(d)) return 'self';
    // 「消耗-0.25」= 自身减免
    if (/心情每小时消耗\s*-/.test(d) || (mc < 0 && /消耗/.test(d))) return 'self';
    if (/心情每小时消耗\+/.test(d)) return 'self'; // 见行者/地灵/泡普卡等：只加自己
    if (mc > 0 && /消耗/.test(d)) return 'self';
    // desc 被结算改写后仍按 moodCost 回退（裁缝/龙舌兰 -0.25 等）
    if (mc < 0) return 'self';
    if (mc > 0 && (skill._hqTier || skill._tequilaBonus)) return 'self';
    if (!mc && !/心情每小时消耗/.test(d)) return 'none';
    return 'none';
  }

  /**
   * 计算设施内每名干员的实际心情消耗/时（含仅自身的加消耗）
   * @returns {{ [charId]: number }}
   */
  getOperatorMoodDrains(roomType, roomIdx, buffEffects = null, baseMoodCost = null) {
    const room = this.layout[roomType]?.[roomIdx];
    if (!room) return {};
    const ops = room.operators.filter(Boolean);
    const effects = buffEffects || this.collectBuffEffects(roomType, ops);
    const pureBase = baseMoodCost != null ? baseMoodCost : this.calcMoodCost(roomType, ops.length);

    // 先把「全体」类从技能叠到 base；「仅自身」记到个人
    const selfExtra = {};
    for (const id of ops) selfExtra[id] = 0;

    for (const { charId, skill } of effects) {
      const bid = skill.buffId || '';
      // 条件触发的心情由下方特例处理
      if (bid === 'trade_ord_spd&cost_P[000]' || bid === 'trade_ord_limit&cost_P[010]'
          || bid === 'trade_ord_limit&cost_P[000]' || bid === 'trade_ord_limit&cost_P[001]'
          || bid === 'trade_ord_limit&cost_P[020]') continue;

      const kind = this.classifyMoodSkill(skill);
      const mc = typeof skill.moodCost === 'number' ? skill.moodCost : 0;
      if (kind === 'all' && mc !== 0) {
        for (const id of ops) selfExtra[id] += mc;
      } else if (kind === 'self' && mc !== 0) {
        if (selfExtra[charId] !== undefined) selfExtra[charId] += mc;
      }
    }

    // 阶段2里一些特殊自身修正（与 resolveSynergy 对齐；全体类已由 classify=all 处理）
    const names = ops.map(id => BUILDING_DATA.chars[id]?.name);
    // 德克萨斯恩怨：仅自身 +0.3（若与拉普兰德同站）— 技能阶段2写入，字段可能未带
    if (names.includes('德克萨斯') && names.includes('拉普兰德')) {
      const texasId = ops.find(id => BUILDING_DATA.chars[id]?.name === '德克萨斯');
      if (texasId) {
        const already = effects.some(e => e.charId === texasId && e.skill.buffId === 'trade_ord_spd&cost_P[000]' && e.skill.moodCost);
        if (!already) selfExtra[texasId] += 0.3;
      }
    }
    // 德克萨斯默契：仅自身 -0.3（与能天使）
    if (names.includes('德克萨斯') && names.includes('能天使')) {
      const texasId = ops.find(id => BUILDING_DATA.chars[id]?.name === '德克萨斯');
      if (texasId) selfExtra[texasId] -= 0.3;
    }
    // 拉普兰德醉翁：仅自身 -0.1（与德克萨斯）
    if (names.includes('拉普兰德') && names.includes('德克萨斯')) {
      const id = ops.find(id => BUILDING_DATA.chars[id]?.name === '拉普兰德');
      if (id) selfExtra[id] -= 0.1;
    }
    // 贝洛内未偿还的债务：与伺夜同站时自身 -0.1
    if (names.includes('贝洛内') && names.includes('伺夜')) {
      const id = ops.find(id => BUILDING_DATA.chars[id]?.name === '贝洛内');
      if (id) selfExtra[id] -= 0.1;
    }

    // resolveSynergy 写入的全体减免（彩虹/异格等 _moodReduce）
    for (const { skill } of effects) {
      if (typeof skill._moodReduce === 'number' && skill._moodReduce !== 0) {
        for (const id of ops) selfExtra[id] -= skill._moodReduce;
      }
    }

    // 槐琥·团队精神：消除本站所有干员「自身」心情消耗技能的影响（回到人数/中枢基底）
    if (effects.some(e => e.skill.buffId === 'manu_cost_all[000]' || e.skill._nullifySelfMood)) {
      for (const id of ops) selfExtra[id] = 0;
    }

    const drains = {};
    for (const id of ops) {
      drains[id] = Math.round(Math.max(0, pureBase + (selfExtra[id] || 0)) * 1000) / 1000;
    }
    return drains;
  }

  // 收集设施内干员的buff（深拷贝以便修改显示数值）
  collectBuffEffects(roomType, operators) {
    const effects = [];
    for (const charId of operators) {
      for (const skill of this.getActiveSkills(charId)) {
        if (skill.roomType === roomType) {
          effects.push({ charId, skill: { ...skill } });
        }
      }
    }
    return effects;
  }

  // --- 新增系统：阵营与全局资源统计 ---
  static FACTIONS = {
    // 注意：维娜·维多利亚不算「格拉斯哥帮」标签（NGA/实测：摩+维+推 = +115%，若维娜算帮则摩根会按3人计成+135%）
    'GLASGOW': ['推进之王', '因陀罗', '摩根', '戴菲恩'],
    'SIRACUSA': [
      '伺夜', '贝洛内', '八幡海铃', '德克萨斯', '缄默德克萨斯', '拉普兰德', '荒芜拉普兰德',
      '空', '空弦', '贾维', '布洛卡', '奥斯塔', '子月', '红', '苏苏洛', '安洁莉娜', '斑点',
      '巫恋', '但书', // 叙拉古；漏记会导致海铃加成错显到「无叙拉古」站
    ],
    'LATERANO': ['能天使', '新约能天使', '蕾缪安', '莫斯提马', '芳汀', '见行者', '圣约送葬人', '送葬人', '安德切尔', '菲亚梅塔', '隐现', '里德尔'],
    'KJERAG': ['银灰', '凛御银灰', '初雪', '崖心', '角峰', '讯使', '极光', '耶拉', '鸿雪'],
    'MONSTER_HUNTER': ['火龙S黑角', '麒麟R夜刀', '泰拉大陆调查团'],
    // PRTS 术语：娜斯提「造价高昂」
    'RHINE_LAB': [
      '赫默', '淬羽赫默', '伊芙利特', '塞雷娅', '白面鸮', '梅尔', '麦哲伦',
      '多萝西', '星源', '溯光星源', '缪尔赛思', '娜斯提',
    ],
    // PRTS 术语：怒潮凛冬「情同手足」条件名单（不含怒潮凛冬自身）
    'URSUS_STUDENT': ['早露', '凛冬', '真理', '古米', '烈夏', '苦艾'],
    // 黑钢国际（杏仁「挑大梁」）
    'BLACKSTEEL': ['芙兰卡', '雷蛇', '杰西卡', '涤火杰西卡', '杏仁', '寻澜'],
    // 萨米（提丰会客「与其他萨米干员」）
    'SAMI': ['提丰', '凛视', '寒檀'],
  };

  getFactionCount(roomType, roomIdx, factionName) {
    const room = this.layout[roomType]?.[roomIdx];
    if (!room) return 0;
    const list = BaseEngine.FACTIONS[factionName] || [];
    let count = 0;
    for (const id of room.operators) {
      if (id && BUILDING_DATA.chars[id] && list.includes(BUILDING_DATA.chars[id].name)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 全基建阵营人数（不含副手=训练室、活动室=会客室）
   * 用于娜斯提/杏仁等「基建内每有1名××」
   */
  getFactionCountGlobal(factionName, { excludeMeeting = true, excludeTraining = true } = {}) {
    const list = BaseEngine.FACTIONS[factionName] || [];
    let count = 0;
    for (const [rt, rooms] of Object.entries(this.layout || {})) {
      if (excludeMeeting && rt === 'MEETING') continue;
      if (excludeTraining && rt === 'TRAINING') continue;
      for (const room of rooms || []) {
        for (const id of (room.operators || []).filter(Boolean)) {
          if (list.includes(BUILDING_DATA.chars[id]?.name)) count++;
        }
      }
    }
    return count;
  }

  /** 宿舍等级合计：每间宿舍的等级之和（娜仁图亚「齐心沙盗」） */
  getDormLevelSum() {
    return (this.layout.DORMITORY || []).reduce((s, r) => s + (r.level || 0), 0);
  }

  /** 古米是否在任一贸易站 */
  hasGumiInTrading() {
    for (const room of this.layout.TRADING || []) {
      for (const id of (room.operators || []).filter(Boolean)) {
        if (BUILDING_DATA.chars[id]?.name === '古米') return true;
      }
    }
    return false;
  }

  /** 某干员是否在指定设施类型（任一房间） */
  hasOperatorInRoomType(charName, roomType) {
    for (const room of this.layout[roomType] || []) {
      for (const id of (room.operators || []).filter(Boolean)) {
        if (BUILDING_DATA.chars[id]?.name === charName) return true;
      }
    }
    return false;
  }

  /** 公开招募初始栏位（不含办公室升级解锁的） */
  static INITIAL_RECRUIT_SLOTS = 2;

  /** 公开招募总栏位：办公室 Lv1/2/3 → 2/3/4 */
  getRecruitSlotCount() {
    const lv = this.layout.HIRE?.[0]?.level || 1;
    return [2, 3, 4][lv - 1] || 4;
  }

  /** 额外招募位（不含初始 2 个）：办公室 Lv1/2/3 → 0/1/2。乌有/月禾/骋风等吃这个 */
  getExtraRecruitSlots() {
    return Math.max(0, this.getRecruitSlotCount() - BaseEngine.INITIAL_RECRUIT_SLOTS);
  }

  /** 办公室拐会客：任意「每额外招募位 +X% 会客线索」技能 */
  getHireMeetingClueBonusEffects() {
    const extra = this.getExtraRecruitSlots();
    const out = [];
    for (const id of (this.layout.HIRE?.[0]?.operators || []).filter(Boolean)) {
      for (const skill of this.getActiveSkills(id)) {
        const d = skill.desc || '';
        if (!/会客室线索/.test(d) || !/招募位/.test(d)) continue;
        const per = +(d.match(/额外\+(\d+(?:\.\d+)?)%会客室/) || d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 5;
        const eff = extra * per;
        out.push({
          charId: id,
          skill: {
            ...skill,
            isGlobal: true,
            roomType: 'MEETING',
            actualEfficiency: eff,
            desc: eff > 0
              ? `${skill.name}（办公室）：额外招募位 ${extra} ×${per}% → 会客线索 +${eff}%（初始位 ${BaseEngine.INITIAL_RECRUIT_SLOTS} 不含）`
              : `${skill.name}（办公室）：无额外招募位 → 会客线索 +0%（办公室 Lv2/Lv3 各+1 额外位）`,
          },
        });
      }
    }
    return out;
  }

  /**
   * 人间烟火近似计数（会客赤刃明霄陈 / 制造黍·截云等）
   * 按当前基建技能来源汇总，不模拟清空时机
   */
  getHumanFireworksCount() {
    let n = 0;
    const ctrl = this.layout.CONTROL?.[0];
    const ctrlIds = (ctrl?.operators || []).filter(Boolean);
    const ctrlNames = ctrlIds.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    const dormHeadcount = (this.layout.DORMITORY || [])
      .reduce((s, r) => s + (r.operators || []).filter(Boolean).length, 0);

    // 乌有·贸易：宿舍每名干员 +1
    for (const room of this.layout.TRADING || []) {
      for (const id of (room.operators || []).filter(Boolean)) {
        if (BUILDING_DATA.chars[id]?.name !== '乌有') continue;
        if (this.getActiveSkills(id).some(s => s.buffId === 'trade_ord_spd_bd_n2[000]')) {
          n += dormHeadcount;
        }
      }
    }
    // 桑葚·办公室：每额外招募位 +10
    for (const id of (this.layout.HIRE?.[0]?.operators || []).filter(Boolean)) {
      if (BUILDING_DATA.chars[id]?.name !== '桑葚') continue;
      if (this.getActiveSkills(id).some(s => (s.buffId || '').startsWith('hire_spd_bd_n1'))) {
        n += this.getExtraRecruitSlots() * 10;
      }
    }
    // 夕 / 令 / 重岳 · 中枢
    for (const id of ctrlIds) {
      const name = BUILDING_DATA.chars[id]?.name;
      const mood = this.getOperatorMood(id);
      const skills = this.getActiveSkills(id);
      if (name === '夕') {
        if (skills.some(s => s.buffId === 'control_mp_cost&bd1[000]') && mood < 12) n += 15;
      }
      if (name === '令') {
        if (skills.some(s => s.buffId === 'control_costToBD[000]') && mood > 12) n += 15;
      }
      if (name === '重岳' && skills.some(s => s.buffId === 'control_mp_cost&bd_up[000]')) {
        const sui = ['年', '夕', '令', '重岳', '黍', '余'];
        let suiN = 0;
        for (const [rt, rooms] of Object.entries(this.layout || {})) {
          if (rt === 'DORMITORY' || rt === 'MEETING') continue;
          for (const room of rooms || []) {
            for (const oid of (room.operators || []).filter(Boolean)) {
              if (sui.includes(BUILDING_DATA.chars[oid]?.name)) suiN++;
            }
          }
        }
        n += Math.min(5, suiN) * 5;
      }
    }
    return n;
  }

  getCatnipCount() {
    let count = 0;
    const ctrlOps = this.layout.CONTROL[0]?.operators || [];
    const names = ctrlOps.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    if (names.includes('火龙S黑角')) {
      const mhCount = names.filter(n => BaseEngine.FACTIONS['MONSTER_HUNTER'].includes(n)).length;
      count += mhCount * 2;
    }
    return count;
  }

  getPassionCount() {
    let count = 0;
    const ctrlOps = this.layout.CONTROL[0]?.operators || [];
    const names = ctrlOps.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    
    if (names.includes('三角初华')) {
      const dormCount = this.layout.DORMITORY.reduce((sum, r) => sum + r.operators.filter(Boolean).length, 0);
      count += dormCount;
    }
    if (names.includes('若叶睦')) {
      count += 20;
    }
    return count;
  }

  /** 情报储备：灰烬在中枢时，中枢内每名彩虹小队干员 +1（满配4人=4） */
  getIntelReserveCount() {
    const ctrlOps = this.layout.CONTROL[0]?.operators.filter(Boolean) || [];
    const names = ctrlOps.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    const hasAsh = names.includes('灰烬');
    if (!hasAsh) return 0;
    // 需灰烬精二「情报储备」技能
    const ashId = ctrlOps.find(id => BUILDING_DATA.chars[id]?.name === '灰烬');
    const hasSkill = ashId && this.getActiveSkills(ashId).some(s => s.buffId === 'control_mp_bd[000]');
    if (!hasSkill) return 0;
    const r6 = ['灰烬', '闪击', '战车', '霜华'];
    return names.filter(n => r6.includes(n)).length;
  }

  /** 魔物料理：森西进宿舍时，该宿舍每级 +1 层（多森西可叠） */
  getMonsterCuisineCount() {
    let count = 0;
    for (const room of this.layout.DORMITORY || []) {
      for (const id of room.operators.filter(Boolean)) {
        const char = BUILDING_DATA.chars[id];
        if (char?.name !== '森西') continue;
        const hasSkill = this.getActiveSkills(id).some(s => s.buffId === 'dorm_rec_bd_dungeon[000]');
        if (hasSkill) count += room.level || 0;
      }
    }
    return count;
  }

  /**
   * 是否「根据设施数量提供加成」的制造生产力
   * （自动化清零会保留；槐琥配合意识不会抄）
   * 含：按发电站 / 贸易站 / 发电站作业平台数。不含至简工程机器人。
   */
  isFacilityCountProdBonus(skill) {
    if (!skill) return false;
    if (skill._isFacilityCountBonus) return true;
    const bid = skill.buffId || '';
    return bid.startsWith('manu_prod_spd&power')
      || bid.startsWith('manu_prod_spd&trade')
      || bid.startsWith('manu_token_prod_spd');
  }

  /** 金属工艺类：金属工艺·α/β（含温米/引星棘刺等同名变体 buffId） */
  isMetalCraftSkill(skill) {
    const bid = skill?.buffId || '';
    return bid === 'manu_formula_spd[100]'
      || bid === 'manu_formula_spd[101]'
      || bid === 'manu_formula_spd[102]'
      || bid === 'manu_formula_spd[110]';
  }

  /**
   * 制造站技能绑定的产物；null = 全产物通用
   * GOLD / EXP / ORUNDUM
   */
  getManufactureSkillProduct(skill) {
    if (!skill) return null;
    const bid = skill.buffId || '';
    const d = skill.desc || '';
    if (bid.includes('&gold')) return 'GOLD';
    if (bid.includes('&exp')) return 'EXP';
    if (bid.includes('&originium')) return 'ORUNDUM';
    // 按贸易站/作业平台抬贵金属
    if (bid.startsWith('manu_prod_spd&trade') || bid.startsWith('manu_token_prod_spd')
        || bid === 'manu_prod_spd_double[000]') {
      return 'GOLD';
    }
    if (bid.startsWith('manu_formula_spd&cost') || bid.startsWith('manu_formula_spd&dorm')) {
      return 'GOLD';
    }
    if (bid.startsWith('manu_formula_spd&limit') || bid.startsWith('manu_formula_spd&bd')
        || bid.startsWith('manu_formula_spd_P') || bid.startsWith('manu_formula_cost')
        || bid.startsWith('manu_formula_limit') || bid === 'manu_prod_spd_double[100]') {
      return 'EXP';
    }
    const m = bid.match(/^manu_formula_spd\[(\d+)\]/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 200) return 'ORUNDUM';
      if (n >= 100) return 'GOLD';
      return 'EXP';
    }
    // 注意：勿用裸「金属工艺」——打工心得等「金属工艺类」计数技是通用生产力
    if (/贵金属类配方|贵金属配方/.test(d)) return 'GOLD';
    if (/作战记录类配方|作战指导|拳术指导/.test(d)) return 'EXP';
    if (/源石材料类配方|源石工艺|地质学|合成玉/.test(d)) return 'ORUNDUM';
    return null;
  }

  /** 标准化 / 莱茵科技 / 红松骑士团（供水月·意识协议等计数） */
  getManuSkillFamily(skill) {
    const bid = skill?.buffId || '';
    const name = skill?.name || '';
    if (this.isMetalCraftSkill(skill)) return 'metal';
    if (/标准化/.test(name) || bid === 'manu_prod_spd[000]' || bid === 'manu_prod_spd[010]' || bid === 'manu_prod_spd[1000]') {
      return 'standard';
    }
    if (/莱茵科技/.test(name) || bid === 'manu_prod_spd[001]' || bid === 'manu_prod_spd[011]' || bid === 'manu_prod_spd[021]') {
      return 'rhine';
    }
    if (/红松骑士团/.test(name) || bid === 'manu_prod_spd[002]' || bid === 'manu_prod_spd[012]') {
      return 'pinus';
    }
    return null;
  }

  // 获取来自控制中枢等全局设施的跨房间Buff
  getGlobalBuffs(targetRoomType, stats = {}) {
    const globals = [];
    const ctrlOps = this.layout.CONTROL[0]?.operators.filter(Boolean) || [];
    
    let maxTraSpd = null;
    let maxProdSpd = null;
    let maxHireSpd = null; // 办公室联络速度：同种取最高（八幡海铃/办公室年度人物等）

    for (const charId of ctrlOps) {
      const charName = BUILDING_DATA.chars[charId]?.name;
      for (const skill of this.getActiveSkills(charId)) {
        const bid = skill.buffId || '';
        // 贸易站全局加成 (如阿米娅、诗怀雅、若叶睦、戴菲恩、八幡海铃)
        if (targetRoomType === 'TRADING') {
          if (bid.startsWith('control_tra_spd')) {
            if (!maxTraSpd || skill.efficiency > maxTraSpd.skill.efficiency) {
              maxTraSpd = { charId, skill: { ...skill, isGlobal: true, actualEfficiency: skill.efficiency } };
            }
          }
          if (charName === '若叶睦') {
            const passion = this.getPassionCount();
            const eff = Math.floor(passion / 8) * 1;
            globals.push({ charId, skill: { ...skill, isGlobal: true, actualEfficiency: eff, desc: skill.desc.replace(/所有贸易站订单效率\+1\%/, `所有贸易站订单效率+1% (当前热情值: ${passion}, 转化+${eff}%)`) } });
          }
          // 阵营条件技：本站没有对应阵营干员时不加算、不展示（避免巫恋站误显海铃等）
          if (charName === '戴菲恩' && stats.roomIdx !== undefined
              && bid.startsWith('control_tra_limit&spd')) {
            const glasgowCount = this.getFactionCount('TRADING', stats.roomIdx, 'GLASGOW');
            if (glasgowCount > 0) {
              const eff = glasgowCount * 10;
              globals.push({
                charId,
                skill: {
                  ...skill,
                  isGlobal: true,
                  actualEfficiency: eff,
                  _factionGate: 'GLASGOW',
                  desc: skill.desc.replace(/订单获取效率\+10\%/, `订单获取效率+10% (本站格拉斯哥帮 ${glasgowCount} 人，+${eff}%)`),
                },
              });
            }
          }
          // 八幡海铃「家族认可」：按本站叙拉古人×5%；本站 0 人则不显示
          if (charName === '八幡海铃' && bid.startsWith('control_tra_limit&spd')
              && stats.roomIdx !== undefined) {
            const local = this.getFactionCount('TRADING', stats.roomIdx, 'SIRACUSA');
            if (local > 0) {
              const eff = local * 5;
              globals.push({
                charId,
                skill: {
                  ...skill,
                  isGlobal: true,
                  actualEfficiency: eff,
                  _factionGate: 'SIRACUSA',
                  desc: `家族认可：本站每名叙拉古干员 +5%（本站 ${local} 人，+${eff}%）；无叙拉古的贸易站不生效`,
                },
              });
            }
          }
          // 凛御银灰「商业版图」：仅「本站满 3 名谢拉格」的贸易站 +10%
          if (charName === '凛御银灰' && bid === 'control_tra_limit&spd3[000]'
              && stats.roomIdx !== undefined) {
            const kj = this.getFactionCount('TRADING', stats.roomIdx, 'KJERAG');
            if (kj >= 3) {
              globals.push({
                charId,
                skill: {
                  ...skill,
                  isGlobal: true,
                  actualEfficiency: 10,
                  _factionGate: 'KJERAG',
                  desc: `商业版图：本站谢拉格 ${kj} 人（≥3）→ 订单获取效率 +10%`,
                },
              });
            }
          }
        }
        
        // 制造站全局加成 (如凯尔希、丰川祥子)
        if (targetRoomType === 'MANUFACTURE') {
          if (bid.startsWith('control_prod_spd')) {
            if (!maxProdSpd || skill.efficiency > maxProdSpd.skill.efficiency) {
              maxProdSpd = { charId, skill: { ...skill, isGlobal: true, actualEfficiency: skill.efficiency } };
            }
          }
          if (charName === '丰川祥子' && stats.product === 'GOLD') {
            const passion = this.getPassionCount();
            const baseEff = skill.efficiency || 1; 
            const eff = baseEff + Math.floor(passion / 20) * baseEff;
            globals.push({ charId, skill: { ...skill, isGlobal: true, actualEfficiency: eff, desc: skill.desc.replace(/所有生产贵金属类配方的制造站生产力\+\d+(?:\.\d+)?\%/g, `生产力+${eff}% (热情值: ${passion})`) } });
          }
        }

        // 办公室联络速度（中枢 → 人力办公室）
        // control_hire_spd_all / control_hire_spd&bd（八幡海铃可靠伙伴）：+10% 同种取最高
        // control_hire_spd[000]「感染力」：条件技（办公室总速<30%时+20%），单独处理
        if (targetRoomType === 'HIRE') {
          if (bid === 'control_hire_spd_all[000]' || bid === 'control_hire_spd&bd[000]') {
            const eff = skill.efficiency || 10;
            if (!maxHireSpd || eff > maxHireSpd.skill.actualEfficiency) {
              maxHireSpd = {
                charId,
                skill: {
                  ...skill,
                  isGlobal: true,
                  actualEfficiency: eff,
                  desc: `${skill.name}：人力办公室联络速度+${eff}%（中枢全局，同种取最高）`,
                },
              };
            }
          }
        }
      }
    }

    if (maxTraSpd) globals.push(maxTraSpd);
    if (maxProdSpd) globals.push(maxProdSpd);
    if (maxHireSpd) globals.push(maxHireSpd);

    // 感染力：办公室联络速度（含基础）小于 30% 时额外 +20%（全局唯一）
    if (targetRoomType === 'HIRE') {
      for (const charId of ctrlOps) {
        for (const skill of this.getActiveSkills(charId)) {
          if (skill.buffId !== 'control_hire_spd[000]') continue;
          const baseOnly = stats.baseRefreshSpeed != null ? stats.baseRefreshSpeed : 30;
          const currentBefore = (stats.refreshSpeedBeforeInfect != null)
            ? stats.refreshSpeedBeforeInfect
            : baseOnly;
          // 判定用「当前已加算后的联络速度」；未传入时仅用设施基础
          if (currentBefore < 30) {
            globals.push({
              charId,
              skill: {
                ...skill,
                isGlobal: true,
                actualEfficiency: 20,
                desc: `${skill.name}：办公室联络速度<30%时 +20%（当前 ${currentBefore}% → 触发）`,
              },
            });
          } else {
            globals.push({
              charId,
              skill: {
                ...skill,
                isGlobal: true,
                actualEfficiency: 0,
                desc: `${skill.name}：需联络速度<30%才 +20%（当前 ${currentBefore}%，未触发）`,
              },
            });
          }
          break;
        }
      }
    }
    
    return globals;
  }

  // 辅助方法：获取基地指定类型设施的总等级
  getFacilityTotalLevel(roomTypes) {
    let total = 0;
    for (const [rType, rooms] of Object.entries(this.layout)) {
      if (!roomTypes || roomTypes.includes(rType)) {
        for (const r of (rooms || [])) {
          total += r.level;
        }
      }
    }
    return total;
  }

  // 作业平台（机器人干员）：承曦格雷伊「晨曦」、阿兰娜「机械精通」、布丁「超频」等共用
  static WORK_PLATFORMS = [
    'Lancet-2', 'Castle-3', 'THRM-EX', '正义骑士号',
    'Friston-3', 'PhonoR-0', 'CONFESS-47', 'GALLUS²',
  ];

  // 异格干员（异格者技能按中枢内异格人数计数；PRTS「异格干员」类 + 常见后续异格）
  static ALTER_OPERATORS = [
    '耀骑士临光', '假日威龙陈', '寒芒克洛丝', '浊心斯卡蒂', '炎狱炎熔',
    '缄默德克萨斯', '归溟幽灵鲨', '濯尘芙蓉', '承曦格雷伊', '百炼嘉维尔',
    '焰影苇草', '淬羽赫默', '圣约送葬人', '琳琅诗怀雅', '纯烬艾雅法拉',
    '涤火杰西卡', '新约能天使', '维什戴尔', '历阵锐枪芬', '维娜·维多利亚',
    '火龙S黑角', '麒麟R夜刀', '司霆惊蛰', '斩业星熊', '圣聆初雪',
    '凛御银灰', '溯光星源', '赤刃明霄陈', '怒潮凛冬', '酒神',
    '凯尔希·思衡托', '予愿安洁莉娜', '引星棘刺', '烛煌', '荒芜拉普兰德',
    '撷英调香师', '弑君者', '魔王', '雷狼龙S空爆', '焰狐龙梓兰',
  ];

  isAlterOperator(charIdOrName) {
    const name = BUILDING_DATA.chars[charIdOrName]?.name || charIdOrName;
    return BaseEngine.ALTER_OPERATORS.includes(name);
  }

  isWorkPlatform(charId) {
    const name = BUILDING_DATA.chars[charId]?.name;
    return !!name && BaseEngine.WORK_PLATFORMS.includes(name);
  }

  // 发电站内作业平台数量（心情为0视为未进驻）
  getWorkPlatformCountInPower(excludeRoomIdx = null) {
    let count = 0;
    for (let i = 0; i < (this.layout.POWER?.length || 0); i++) {
      if (excludeRoomIdx !== null && i === excludeRoomIdx) continue;
      const room = this.layout.POWER[i];
      for (const id of room.operators) {
        if (!id || !this.isWorkPlatform(id)) continue;
        if (this.getOperatorMood(id) <= 0) continue;
        count++;
      }
    }
    return count;
  }

  // 无人机上限估算（清理房间提升上限；按当前布局房间格拟合，满配约225）
  getDroneLimit() {
    let slots = 1; // 加工站固定存在
    for (const rooms of Object.values(this.layout)) {
      slots += (rooms || []).length;
    }
    return Math.floor(20 + slots * 11.4);
  }

  // ----------------------------------------------------------
  // 赤金订单分布（PRTS）：按贸易站等级；高品质技能仅对3级站有4金池
  // Lv1: 2金100% | Lv2: 2金60%/3金40% | Lv3: 2金30%/3金50%/4金20%
  // 3级站峰值（工作时长满）：α小幅 / β提升 / αα叠加（观测值）
  // ----------------------------------------------------------
  static GOLD_ORDER_BASE = {
    1: { 2: 1.00, 3: 0.00, 4: 0.00 },
    2: { 2: 0.60, 3: 0.40, 4: 0.00 },
    3: { 2: 0.30, 3: 0.50, 4: 0.20 },
  };
  static GOLD_ORDER_L3_HQ = {
    alpha:  { 2: 0.15, 3: 0.30, 4: 0.55 },
    alpha2: { 2: 0.13, 3: 0.22, 4: 0.65 },
    beta:   { 2: 0.05, 3: 0.10, 4: 0.85 },
  };

  /** 解析房间内高品质订单技能档位：none / alpha / alpha2 / beta */
  getGoldOrderHqTier(buffEffects) {
    let alphaCount = 0;
    let hasBeta = false;
    for (const { skill } of buffEffects) {
      const m = (skill.buffId || '').match(/^trade_ord_wt&cost\[(\d+)\]$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      // β: 010/011/012 ；α: 000/001/002/003/004
      if (n >= 10) hasBeta = true;
      else alphaCount++;
    }
    if (hasBeta) return 'beta';
    if (alphaCount >= 2) return 'alpha2';
    if (alphaCount >= 1) return 'alpha';
    return 'none';
  }

  getGoldOrderDistribution(level, buffEffects = []) {
    const lv = Math.min(3, Math.max(1, level || 1));
    const base = BaseEngine.GOLD_ORDER_BASE[lv];
    // 1/2 级没有4金订单，高品质技能无法改变分布
    if (lv < 3) return { ...base, tier: 'none' };
    const tier = this.getGoldOrderHqTier(buffEffects);
    if (tier === 'none') return { ...base, tier };
    const hq = BaseEngine.GOLD_ORDER_L3_HQ[tier];
    return { ...hq, tier };
  }

  avgGoldOrderLmd(dist) {
    return 1000 * (dist[2] || 0) + 1500 * (dist[3] || 0) + 2000 * (dist[4] || 0);
  }

  /**
   * 有效发电站数量（仅影响“按设施数量”类技能）
   * = 物理发电站 + 森蚺中枢·Lancet-2(+2) + 承曦格雷伊·晨曦(+1)
   */
  getEffectivePowerCount() {
    let powerCount = this.layout.POWER?.length || 0;

    // 森蚺在中枢 + Lancet-2 在发电站（心情>0）→ 虚拟 +2
    const zumaInCtrl = this.layout.CONTROL[0]?.operators.some(
      id => BUILDING_DATA.chars[id]?.name === '森蚺'
    );
    const hasLancetInPower = (this.layout.POWER || []).some(r =>
      r.operators.some(id => {
        if (BUILDING_DATA.chars[id]?.name !== 'Lancet-2') return false;
        return this.getOperatorMood(id) > 0;
      })
    );
    if (zumaInCtrl && hasLancetInPower) powerCount += 2;

    // 承曦格雷伊·晨曦：自身在发电站，且其他发电站无作业平台 → 虚拟 +1
    for (let i = 0; i < (this.layout.POWER?.length || 0); i++) {
      const room = this.layout.POWER[i];
      const hasGreyy2 = room.operators.some(id => BUILDING_DATA.chars[id]?.name === '承曦格雷伊');
      if (!hasGreyy2) continue;
      // 精二才有晨曦（slot1）
      const greyyId = room.operators.find(id => BUILDING_DATA.chars[id]?.name === '承曦格雷伊');
      const hasDawn = this.getActiveSkills(greyyId).some(s => s.buffId === 'power_count[000]');
      if (!hasDawn) continue;
      if (this.getWorkPlatformCountInPower(i) === 0) {
        powerCount += 1;
      }
      break;
    }

    return powerCount;
  }

  /** 查找干员当前所在设施 */
  findOperatorLocation(nameOrId) {
    const wantName = BUILDING_DATA.chars[nameOrId]?.name || nameOrId;
    for (const roomType of Object.keys(this.layout)) {
      const rooms = this.layout[roomType] || [];
      for (let i = 0; i < rooms.length; i++) {
        for (const id of rooms[i].operators) {
          if (BUILDING_DATA.chars[id]?.name === wantName) {
            return { roomType, roomIdx: i, charId: id };
          }
        }
      }
    }
    return null;
  }

  /**
   * 布局互斥 / 条件失效检测（手动乱放后也要能提示）
   * @returns {{ id: string, level: 'error'|'warn'|'info', msg: string }[]}
   */
  detectLayoutConflicts() {
    const conflicts = [];
    const nameIn = (roomType, name) =>
      (this.layout[roomType] || []).some(r =>
        r.operators.some(id => BUILDING_DATA.chars[id]?.name === name)
      );
    const manuNames = new Set();
    for (const r of this.layout.MANUFACTURE || []) {
      for (const id of r.operators) {
        const n = BUILDING_DATA.chars[id]?.name;
        if (n) manuNames.add(n);
      }
    }
    const hasAutoCore = ['清流', '温蒂', '森蚺', '异客', '掠风'].some(n => manuNames.has(n));

    // --- 承曦晨曦 ---
    let greyyPowerIdx = -1;
    for (let i = 0; i < (this.layout.POWER?.length || 0); i++) {
      if (this.layout.POWER[i].operators.some(id => BUILDING_DATA.chars[id]?.name === '承曦格雷伊')) {
        greyyPowerIdx = i;
        break;
      }
    }
    const greyyInPower = greyyPowerIdx >= 0;
    const zumaInCtrl = nameIn('CONTROL', '森蚺');
    const zumaInManu = manuNames.has('森蚺');
    const lancetInPower = (this.layout.POWER || []).some(r =>
      r.operators.some(id => BUILDING_DATA.chars[id]?.name === 'Lancet-2' && this.getOperatorMood(id) > 0)
    );
    const otherPlatforms = greyyInPower ? this.getWorkPlatformCountInPower(greyyPowerIdx) : 0;

    if (greyyInPower && otherPlatforms > 0) {
      conflicts.push({
        id: 'dawn-blocked',
        level: 'error',
        msg: `承曦「晨曦」未生效：其他发电站有 ${otherPlatforms} 台作业平台（Lancet-2/Castle-3 等会打断晨曦）`,
      });
    }

    if (greyyInPower && zumaInCtrl && lancetInPower) {
      conflicts.push({
        id: 'virtual-power-mutex',
        level: 'error',
        msg: '虚电站互斥：承曦晨曦 与「森蚺中枢 + Lancet-2」同时存在；Lancet 会阻断晨曦，请只保留一条路线',
      });
    } else if (greyyInPower && zumaInCtrl && !lancetInPower) {
      conflicts.push({
        id: 'zuma-ctrl-vs-dawn',
        level: 'warn',
        msg: '森蚺在中枢但未配 Lancet-2（虚+2未触发）。若走承曦晨曦路线，请把森蚺改到制造站',
      });
    }

    if (hasAutoCore && greyyInPower && zumaInCtrl && !zumaInManu) {
      conflicts.push({
        id: 'zuma-should-manu',
        level: 'warn',
        msg: '自动化制造已开、且已上承曦：森蚺更适合进制造站清零，而不是中枢',
      });
    }

    if (zumaInCtrl && lancetInPower && !greyyInPower && hasAutoCore && !zumaInManu) {
      conflicts.push({
        id: 'zuma-alt-path',
        level: 'info',
        msg: '当前为「森蚺中枢 + Lancet-2」虚电路线（与承曦晨曦互斥）。制造站清零可改用温蒂',
      });
    }

    // 制造站同时上清流+异客/掠风：设施数加成可叠但异客占位浪费发电思路
    if (manuNames.has('清流') && (manuNames.has('异客') || manuNames.has('掠风'))) {
      conflicts.push({
        id: 'qingliu-yike-overlap',
        level: 'info',
        msg: '制造站同时有清流与异客/掠风：清流已够用，异客/掠风更占位置（可卸下省位）',
      });
    }

    // 贸易：巫恋低语 vs 但书违约
    for (const room of this.layout.TRADING || []) {
      const names = room.operators.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
      if (names.includes('巫恋') && names.includes('但书')) {
        conflicts.push({
          id: 'wulian-butu',
          level: 'warn',
          msg: '同一贸易站同时有巫恋与但书：高品质抬4金会削弱但书违约覆盖，不建议混用',
        });
        break;
      }
    }

    return conflicts;
  }

  // 核心联动解析器
  resolveSynergy(roomType, ops, buffEffects, stats) {
    const charIds = ops.filter(Boolean);
    const charNames = charIds.map(id => BUILDING_DATA.chars[id]?.name).filter(Boolean);
    
    // ==========================================
    // 阶段1：静态属性收集（排除一些需要条件触发的特殊技能）
    // ==========================================
    const conditionalBuffs = [
      'trade_ord_spd&cost_P[000]', // 德克萨斯 (恩怨)
      'trade_ord_limit&cost_P[010]', // 德克萨斯 (默契)
      'trade_ord_limit&cost_P[000]', // 拉普兰德 (α)
      'trade_ord_limit&cost_P[001]',  // 拉普兰德 (β)
      'trade_ord_limit&cost_P[020]', // 贝洛内 - 未偿还的债务
      'trade_ord_spd_ext[000]',      // 深巡 α
      'trade_ord_spd_ext[001]',      // 深巡 β
      'trade_ord_spd_ext[020]',      // 贝洛内 家族经营·α
      'trade_ord_spd_ext[021]',      // 贝洛内 家族经营·β
      'manu_constrLv[000]',        // 至简 (绘图设计) - 提供机制，不提供效率
      'control_mp_cost&faction[990]', // 彩虹小队中枢永动
      'control_mp_cost&faction[900]', // 异格者中枢永动
      'control_mp_bd[000]',           // 灰烬 - 情报储备（机制）
      'control_mp_bd[010]',           // 战车 - 乌萨斯特饮（机制）
      'manu_prod_spd_addition[030]', // 芬 - 渐进加成
      'manu_prod_spd_addition[031]', // 刻俄柏 - 渐进加成
      'manu_prod_spd_addition[040]', // 克洛丝 - 渐进加成
      'manu_prod_spd_addition[041]', // 稀音 - 渐进加成
      'manu_prod_spd_addition[100]', // 阿罗玛 - 例行清扫（每小时+2%→20%）
      'manu_prod_cost_min[001]',     // 机械师 - 「我睡过了」（满12h才+10%）
      'manu_skill_spd1[000]',        // 水月 - 意识协议（标准化计数）
      'manu_skill_spd1[010]',        // 多萝西 - 莱茵科技计数
      'manu_skill_spd1[020]',        // 苍苔 - 打工心得（金属工艺计数）
      'manu_skill_change[000]',      // 水月 - 意识兼容（莱茵/红松视作标准化）
      'manu_prod_spd_bd[400]',       // 玛露西尔 - 意想不到的美味（魔物料理）
      'manu_prod_spd_variable3[000]',// 泡泡 - 大就是好！（按人分别算库容）
      'manu_prod_spd_variable2[000]',// 槐琥 - 配合意识（抄其他干员生产力）
      'manu_cost_all[000]',          // 槐琥 - 团队精神（消自身心情影响）
      'manu_prod_spd_variable[000]', // 红云 - 回收利用
      'manu_prod_spd_P[008]',        // 红云变体
      'trade_ord_spd&share[001]',    // 吉星 - 勤俭经营·α
      'trade_ord_spd&share[002]',    // 吉星 - 勤俭经营·β
      'meet_spd_hast[000]',          // 伊内丝 - 渐进加成
      'meet_spd_bd[000]',            // 双月 - 情报专家
      'meet_spd_bd[001]',            // 莱欧斯 - 饱餐的干劲
      'meet_spd_bd[002]',            // 赤刃明霄陈 - 人间烟火
      'meet_spd_ext&P[000]',         // 信仰搅拌机 - 菲亚梅塔在宿舍
      'meet_spd&bd[100]',            // 忍冬 - 铃兰同站
      'meet_spd&clue[000]',          // 骋风 - 招募位
      'meet_spd&exchange[000]',      // 跃跃 - 线索交流
      'meet_spd&exchange[001]',      // 响石 - 线索交流
      'meet_spd_notOwned&exchange[000]', // 骋风 - 交流倾向（无速度）
      'meet_spd&condChar_mustget[000]',
      'meet_spd&condChar_mustget[100]',
      'meet_team&char[000]',         // 哈洛德 - 倾向（无速度）
      'power_rec_spd&addition[000]', // 空构 - 渐进加成
      'power_rec_spd&addition[001]', // 空构 - 渐进加成
      'trade_ord_line_gold[000]',    // 绮良
      'trade_ord_line_gold[010]',    // 绮良
      'trade_ord_line_durin[010]',   // 鸿雪
      'manu_prod_spd&power[000]',    // 自动化·α (森蚺/异客/掠风)
      'manu_prod_spd&power[010]',    // 自动化·β (森蚺/温蒂)
      'manu_prod_spd&power[020]',    // 仿生海龙 (温蒂E2)
      'manu_prod_spd&trade[000]',    // 清流 - 再生能源（每贸易+20%贵金属）
      'manu_prod_spd&trade[1000]',   // 引星棘刺 - 原质塑金副产物（每贸易+3%贵金属）
      'manu_prod_spd_double[000]',   // 阿兰娜 - 搞把手！
      'manu_token_prod_spd[000]',    // 阿兰娜 - 机械精通·α（按作业平台数）
      'manu_token_prod_spd[010]',    // 阿兰娜 - 机械精通·β（按作业平台数）
      'manu_formula_spd&dorm&lv[000]', // 娜仁图亚 - 齐心沙盗（宿舍等级）
      'manu_formula_spd&cost_bd[000]', // 杏仁 - 挑大梁（黑钢人数）
      'manu_formula_spd&cost_bd[100]', // 娜斯提 - 造价高昂（莱茵人数）
      'manu_prod_spd_train&lv[000]', // 维伊 - 手艺人（训练室等级）
      'manu_formula_spd_P[000]',     // 烈夏 - 患难拍档（古米在贸易站）
      'manu_formula_spd&bd[000]',    // 怒潮凛冬 - 战阵领袖
      'manu_formula_spd&bd[001]',    // 怒潮凛冬 - 情同手足（+乌萨斯学生）
      'power_rec_drone[000]',        // 承曦格雷伊 - 巡线框架
      'power_count[000]',            // 承曦格雷伊 - 晨曦（仅影响设施数量）
      'trade_ord_vodfox[000]',       // 巫恋 - 低语
      'trade_ord_limit_diff[000]',   // 孑 - 摊贩经济
      'trade_ord_limit_count[000]',  // 孑 - 市井之道
      'trade_ord_long[000]',         // 龙舌兰 - 投资·α（龙门币收益，非效率%）
      'trade_ord_long[010]',         // 龙舌兰 - 投资·β
      'trade_ord_law[000]',          // 但书 - 合同法
      'trade_ord_against[000]',      // 但书 - 违约索赔·α
      'trade_ord_against[010]',      // 但书 - 违约索赔·β
      'trade_ord_wt&cost[000]',      // 高品质订单·α（裁缝/手工艺等）
      'trade_ord_wt&cost[001]',
      'trade_ord_wt&cost[002]',
      'trade_ord_wt&cost[003]',
      'trade_ord_wt&cost[004]',
      'trade_ord_wt&cost[010]',      // 高品质订单·β
      'trade_ord_wt&cost[011]',
      'trade_ord_wt&cost[012]',
      'trade_ord_spd&wt[000]',       // U-Official 固定2金
    ];

    // 误抓为 capacity 的字段（龙门币收益/交付数等），绝不能加到订单上限
    const notOrderLimitBuffs = new Set([
      'trade_ord_long[000]', 'trade_ord_long[010]',
      'trade_ord_against[000]', 'trade_ord_against[010]',
      'trade_ord_limit_diff[000]',  // capacity 字段是差额倍率，不是订单上限
      'trade_ord_limit_count[000]',
    ]);

    for (const { skill } of buffEffects) {
      if (conditionalBuffs.includes(skill.buffId)) continue; // 跳过，由阶段2特定处理

      if (typeof skill.capacity === 'number' && skill.capacity !== 0) {
        if (roomType === 'MANUFACTURE') stats.capacity += skill.capacity;
        if (roomType === 'TRADING' && !notOrderLimitBuffs.has(skill.buffId)) {
          stats.orderLimit += skill.capacity;
        }
      }
      if (typeof skill.moodCost === 'number' && skill.moodCost !== 0) {
        // 仅「全体」类进房间汇总；「仅自身」留给 per-op drains，避免见行者等把全屋拉高
        const kind = this.classifyMoodSkill(skill);
        if (kind === 'all') {
          stats.moodCost += skill.moodCost;
        }
        // self / recover：不写入房间统一 moodCost
      }
    }

    // ==========================================
    // 阶段2：动态加成与特定干员组合（覆盖默认的efficiency）
    // ==========================================
    let extraEfficiency = 0;
    
    // 预处理贸易站：赤金线（鸿雪/图耶/绮良按站位分别吃线，见 calcGoldLineTeam）
    let goldTeam = null;
    if (roomType === 'TRADING') {
      const hasGoldTeam = buffEffects.some(e =>
        e.skill.buffId === 'trade_ord_line_durin[010]'
        || e.skill.buffId === 'trade_ord_spd&gold[000]'
        || e.skill.buffId === 'trade_ord_spd&gold[010]'
        || e.skill.buffId === 'trade_ord_spd&gold[100]'
        || (e.skill.buffId || '').startsWith('trade_ord_line_gold')
      );
      if (hasGoldTeam) goldTeam = this.calcGoldLineTeam(charIds, buffEffects);
    }
    // 其它技能若仍引用 goldLines：退化为制造赤金数 + 杜林线（不含错误叠绮良）
    let goldLines = 0;
    if (this.layout.MANUFACTURE) {
      goldLines = this.layout.MANUFACTURE.filter(r => (r.product || 'GOLD') === 'GOLD').length;
    }
    if (roomType === 'TRADING' && buffEffects.some(e => e.skill.buffId === 'trade_ord_line_durin[010]')) {
      goldLines += Math.min(4, this.getWorkingDurinCount());
    }

    // 渐进技工作时长：必须用「已损失心情 ÷ 个人消耗/时」
    // 旧逻辑按 1 心情=1 小时，有中枢减免（如 0.75/h）时伊内丝等会少算时间、迟迟到不了峰值
    const roomIdxForDrain = stats.roomIdx != null ? stats.roomIdx : 0;
    const baseMoodForDrain = this.calcMoodCost(roomType, charIds.length);
    const moodDrains = this.getOperatorMoodDrains(roomType, roomIdxForDrain, buffEffects, baseMoodForDrain);

    for (const { charId, skill } of buffEffects) {
      const bid = skill.buffId;
      const currentMood = this.getOperatorMood(charId);
      const drainPerHour = moodDrains[charId] != null ? moodDrains[charId] : baseMoodForDrain;
      const hoursPassed = drainPerHour > 0.001
        ? Math.max(0, (24.0 - currentMood) / drainPerHour)
        : 0;
      let applied = false;

      // 产物匹配过滤 (制造站)：专精配方与当前产物不符 → 生产力不生效
      if (roomType === 'MANUFACTURE') {
        const p = stats.product || 'GOLD';
        const need = this.getManufactureSkillProduct(skill);
        if (need && need !== p) {
          const label = { GOLD: '赤金', EXP: '经验', ORUNDUM: '搓玉' }[need] || need;
          const cur = { GOLD: '赤金', EXP: '经验', ORUNDUM: '搓玉' }[p] || p;
          skill.actualEfficiency = 0;
          skill._productMismatch = true;
          skill._productNeed = need;
          const rawDesc = (skill.desc || '').replace(/^\[产物不匹配[^\]]*\]\s*/, '');
          skill.desc = `[不生效·需${label}，当前${cur}] ${rawDesc}`;
          applied = true;
          continue;
        }
      }

      // --- 贸易站联动 ---
      if (roomType === 'TRADING') {
        const charName = BUILDING_DATA.chars[charId]?.name;
        
        // 叙拉古体系
        if (charName === '伺夜') {
          const meetingLvl = this.layout.MEETING?.[0]?.level || 0;
          const extra = Math.min(15, meetingLvl * 5);
          skill.actualEfficiency = 25 + extra;
          extraEfficiency += skill.actualEfficiency;
          skill.desc = skill.desc.replace(/最多提供40\%效率/, `(当前加成: +${extra}%)`);
          applied = true;
        }
        // 格拉斯哥帮
        else if (charName === '摩根') {
          const glasgowCount = this.getFactionCount('TRADING', stats.roomIdx, 'GLASGOW');
          const hasSiege = charNames.includes('推进之王');
          skill.actualEfficiency = (glasgowCount * 20) + (hasSiege ? 35 : 0);
          extraEfficiency += skill.actualEfficiency;
          skill.desc = `帮派指南针：格拉斯哥${glasgowCount}人×20%${hasSiege ? '+推王35%' : ''} = +${skill.actualEfficiency}%`;
          applied = true;
        }
        else if (charName === '维娜·维多利亚') {
          // 维娜自身不带格拉斯哥标签；「存在格拉斯哥帮干员」看同站是否有推王/摩根等
          const glasgowCount = this.getFactionCount('TRADING', stats.roomIdx, 'GLASGOW');
          const extra = glasgowCount > 0 ? 10 : 0;
          skill.actualEfficiency = 30 + extra;
          extraEfficiency += skill.actualEfficiency;
          skill.desc = `${skill.name}：+${30 + extra}% (格拉斯哥同站: ${glasgowCount > 0 ? '有' : '无'})`;
          applied = true;
        }
        // 拉特兰
        else if (charName === '蕾缪安') {
          const hasExusiai = charNames.includes('能天使');
          skill.actualEfficiency = 20 + (hasExusiai ? 25 : 0);
          extraEfficiency += skill.actualEfficiency;
          applied = true;
        }
        else if (charName === '新约能天使') {
          const lateranoCount = this.getFactionCount('TRADING', stats.roomIdx, 'LATERANO');
          skill.actualEfficiency = lateranoCount * 15;
          extraEfficiency += skill.actualEfficiency;
          applied = true;
        }
        // 怪猎 - 调查团
        else if (charName === '泰拉大陆调查团') {
          const catnip = this.getCatnipCount();
          skill.actualEfficiency = 5 + (catnip * 3);
          extraEfficiency += skill.actualEfficiency;
          applied = true;
        }

        // 德克萨斯 - 恩怨 
        if (bid === 'trade_ord_spd&cost_P[000]') {
          if (charNames.includes('拉普兰德')) { 
            extraEfficiency += 65; 
            skill.actualEfficiency = 65;
          } else {
            skill.actualEfficiency = 0;
          }
          applied = true;
        }
        // 德克萨斯 - 默契
        else if (bid === 'trade_ord_limit&cost_P[010]') {
          applied = true;
        }
        // 拉普兰德 - 醉翁之意
        else if (bid === 'trade_ord_limit&cost_P[000]' || bid === 'trade_ord_limit&cost_P[001]') {
          if (charNames.includes('德克萨斯')) {
            stats.orderLimit += (bid === 'trade_ord_limit&cost_P[001]' ? 4 : 2);
          }
          applied = true;
        }
        // 孑 - 摊贩经济（订单差额×4%，按满差额估算）
        else if (bid === 'trade_ord_limit_diff[000]' || bid === 'trade_ord_spd_P[011]' || bid === 'trade_ord_spd_P[012]') {
          const eff = stats.orderLimit * 4;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `摊贩经济：订单差额×4% (满差额按上限${stats.orderLimit}计 +${eff}%)`;
          applied = true;
        }
        // 孑 - 市井之道（他人每10%效率使上限-1；每单+4%，按满单估算）
        else if (bid === 'trade_ord_limit_count[000]' || bid === 'trade_ord_spd_limit_P[000]') {
          let otherEff = 0;
          for (const { charId: cid, skill: sk } of buffEffects) {
            if (cid === charId) continue;
            if (typeof sk.actualEfficiency === 'number') otherEff += sk.actualEfficiency;
          }
          const cut = Math.floor(Math.max(0, otherEff) / 10);
          const newLimit = Math.max(1, stats.orderLimit - cut);
          stats.orderLimit = newLimit;
          const eff = newLimit * 4;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `市井之道：他人效率${Math.round(otherEff)}%→上限-${cut}为${newLimit}，满单+${eff}%`;
          applied = true;
        }
        // 空弦 - 虔诚筹款
        else if (bid === 'trade_ord_spd&dorm&lv[000]' || bid === 'trade_ord_spd&dorm&lv[010]') {
          const dormTotalLevel = this.getFacilityTotalLevel(['DORMITORY']);
          const multiplier = bid === 'trade_ord_spd&dorm&lv[010]' ? 2 : 1;
          const eff = dormTotalLevel * multiplier;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        // 深巡 - 对陆接洽代表（依赖乌尔比安）
        else if (bid === 'trade_ord_spd_ext[000]' || bid === 'trade_ord_spd_ext[001]') {
          let hasUlpian = false;
          for (const rt in this.layout) {
            for (const r of this.layout[rt]) {
              for (const id of r.operators) {
                if (id && BUILDING_DATA.chars[id]?.name === '乌尔比安') hasUlpian = true;
              }
            }
          }
          const isE2 = bid === 'trade_ord_spd_ext[001]';
          const baseEff = isE2 ? 30 : 25;
          const extraEff = isE2 ? 10 : 5;
          const totalEff = baseEff + (hasUlpian ? extraEff : 0);
          extraEfficiency += totalEff;
          skill.actualEfficiency = totalEff;
          skill.desc = skill.desc.replace(/订单获取效率额外\+\d+\%/, `订单获取效率额外+${extraEff}% (乌尔比安: ${hasUlpian ? '已生效' : '未生效'})`);
          applied = true;
        }
        // 贝洛内 - 家族经营（依赖伺夜在基建内，不含副手/活动室）
        else if (bid === 'trade_ord_spd_ext[020]' || bid === 'trade_ord_spd_ext[021]') {
          let hasVigil = false;
          for (const rt in this.layout) {
            // 活动室本模拟器未建模；副手未建模 → 扫描工作区即可
            if (rt === 'TRAINING') continue;
            for (const r of this.layout[rt]) {
              if (r.operators.some(id => BUILDING_DATA.chars[id]?.name === '伺夜')) hasVigil = true;
            }
          }
          const isE2 = bid === 'trade_ord_spd_ext[021]';
          const baseEff = isE2 ? 30 : 25;
          const extraEff = isE2 ? 10 : 5;
          const totalEff = baseEff + (hasVigil ? extraEff : 0);
          extraEfficiency += totalEff;
          skill.actualEfficiency = totalEff;
          skill.desc = skill.desc.replace(
            /当伺夜在基建内时[^；%]*额外\+\d+%/,
            `当伺夜在基建内时额外+${extraEff}% (伺夜: ${hasVigil ? '已生效' : '未生效'})`
          );
          applied = true;
        }
        // 贝洛内 - 未偿还的债务（需与伺夜同贸易站）
        else if (bid === 'trade_ord_limit&cost_P[020]') {
          const hasVigilHere = charNames.includes('伺夜');
          if (hasVigilHere) {
            stats.orderLimit += 2;
            skill.actualEfficiency = 0;
            skill.desc = skill.desc.replace(/当与伺夜在同一个贸易站时/, `当与伺夜在同一个贸易站时 (已生效: 上限+2, 心情-0.1)`);
          } else {
            skill.actualEfficiency = 0;
            skill.desc = skill.desc.replace(/当与伺夜在同一个贸易站时/, `当与伺夜在同一个贸易站时 (未生效)`);
          }
          applied = true;
        }
        // 图耶 / 鸿雪 / 绮良体系（站序：绮良→图耶→鸿雪 为顶配）
        else if (bid === 'trade_ord_spd&gold[000]' || bid === 'trade_ord_spd&gold[010]') { // 图耶
          const g = goldTeam || this.calcGoldLineTeam(charIds, buffEffects);
          const eff = g.tEff;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          const kPart = g.tGetsKirara ? `+绮良加${g.kiraraExtra}` : (g.kiraraExtra ? '；站序未吃到绮良加线' : '');
          skill.desc = `物流规划：+${eff}%（线${g.tLines}=造${g.manuGold}+杜林${g.durinLines}${kPart}）`;
          applied = true;
        }
        else if (bid === 'trade_ord_spd&gold[100]') { // 鸿雪 E1
          const g = goldTeam || this.calcGoldLineTeam(charIds, buffEffects);
          const eff = g.hEff;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          const kPart = g.hGetsKirara ? `+绮良加${g.kiraraExtra}` : (g.kiraraExtra ? '；要吃绮良线需站序「绮良→图耶→鸿雪」' : '');
          skill.desc = `销路宣发：+${eff}%（线${g.hLines}=造${g.manuGold}+杜林${g.durinLines}${kPart}）`;
          applied = true;
        }
        else if (bid.startsWith('trade_ord_line_gold')) { // 绮良
          const g = goldTeam || this.calcGoldLineTeam(charIds, buffEffects);
          skill.actualEfficiency = g.kEff;
          extraEfficiency += g.kEff;
          skill.desc = `订单流可视化：+${g.kEff}%；额外生产线 +${g.kiraraExtra}（只认制造赤金${g.manuGold}；顶配站序排最左）`;
          applied = true;
        }
        else if (bid === 'trade_ord_line_durin[010]') { // 鸿雪 E2
          const durins = Math.min(4, this.getWorkingDurinCount());
          skill.actualEfficiency = 0;
          skill.desc = `际崖居民：场上杜林 ${durins}/4 → 杜林赤金线（不进绮良加线基数）`;
          applied = true;
        }
        // --- 巫恋 - 低语（清零他人订单效率，每名其他干员为自身+45%）---
        else if (bid === 'trade_ord_vodfox[000]') {
          const others = Math.max(0, charIds.length - 1);
          const eff = others * 45;
          skill.actualEfficiency = eff;
          extraEfficiency += eff;
          skill._triggersWhisperReset = true;
          // 全体心情消耗+0.25（按人计，不在此乘人数塞进房间均值）
          // per-op 由 getOperatorMoodDrains / 技能 moodCost=0.25(all) 处理
          skill.desc = `进驻贸易站时，其他干员订单效率归零，每人为自身+45% (当前+${eff}%)，全体心情消耗+0.25/h`;
          applied = true;
        }
        // --- 高品质贵金属订单权重（裁缝/手工艺/鉴定师等）---
        else if (bid.startsWith('trade_ord_wt&cost')) {
          const m = bid.match(/\[(\d+)\]$/);
          const n = m ? parseInt(m[1], 10) : 0;
          const isBeta = n >= 10;
          skill.actualEfficiency = 0;
          skill._hqTier = isBeta ? 'beta' : 'alpha';
          // 自身心情-0.25：见 getOperatorMoodDrains
          applied = true;
        }
        // --- 龙舌兰 - 投资：4金订单额外龙门币，折算为等效效率（阶段末统一算）---
        else if (bid.startsWith('trade_ord_long')) {
          skill.actualEfficiency = 0;
          skill._tequilaBonus = bid === 'trade_ord_long[010]' ? 500 : 250;
          // 自身心情-0.25：见 getOperatorMoodDrains
          applied = true;
        }
        // --- 但书 - 合同法：非4金视为违约 ---
        else if (bid === 'trade_ord_law[000]') {
          skill.actualEfficiency = 0;
          skill._butuLaw = true;
          applied = true;
        }
        // --- 但书 - 违约索赔：违约订单额外+1/+2 赤金交付（阶段末折算）---
        else if (bid.startsWith('trade_ord_against')) {
          skill.actualEfficiency = 0;
          skill._butuAgainst = bid === 'trade_ord_against[010]' ? 2 : 1;
          applied = true;
        }
        // --- U-Official：订单效率+10%，且赤金订单固定2金（且不视作违约，克制但书）---
        else if (bid === 'trade_ord_spd&wt[000]') {
          skill.actualEfficiency = 10;
          extraEfficiency += 10;
          skill._forceGold2 = true;
          skill._noBreach = true;
          applied = true;
        }
        // --- 吉星 - 勤俭经营：除自身外每人 +10%/+20% ---
        else if (bid === 'trade_ord_spd&share[001]' || bid === 'trade_ord_spd&share[002]') {
          const others = Math.max(0, charIds.length - 1);
          const per = bid === 'trade_ord_spd&share[002]' ? 20 : 10;
          const eff = others * per;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `勤俭经营：除自身外 ${others} 人×${per}% = +${eff}%`;
          applied = true;
        }
      }

      // --- 制造站联动 ---
      if (roomType === 'MANUFACTURE') {
        const charName = BUILDING_DATA.chars[charId]?.name;
      // --- 自动化体系 (温蒂/森蚺/异客/掠风) ---
        // 按有效发电站数加成；可叠加承曦格雷伊「晨曦」、森蚺「我寻思能行」的虚拟站数
        if (bid.startsWith('manu_prod_spd&power')) {
          const powerCount = this.getEffectivePowerCount();
          const perPower = bid === 'manu_prod_spd&power[020]' ? 15 : bid === 'manu_prod_spd&power[010]' ? 10 : 5;
          const eff = powerCount * perPower;
          skill.actualEfficiency = eff;
          extraEfficiency += eff;
          skill._isFacilityCountBonus = true;

          const hasAutoOp = charNames.some(n => n === '温蒂' || n === '森蚺' || n === '异客' || n === '掠风');
          if (hasAutoOp) {
            skill._triggersAutoReset = true;
          }
          skill.desc = skill.desc.replace(/每个发电站为当前制造站\+\d+\%的生产力/, `每个发电站+${perPower}% (有效发电站数: ${powerCount}, 当前生效: +${eff}%)`);
          applied = true;
        }

        // --- 清流 / 引星棘刺：按贸易站数抬贵金属生产力 ---
        else if (bid === 'manu_prod_spd&trade[000]' || bid === 'manu_prod_spd&trade[1000]') {
          if (stats.product !== 'GOLD') {
            skill.actualEfficiency = 0;
            skill.desc = '[产物不匹配] ' + skill.desc;
          } else {
            // 按贸易站「设施数量」计，与贸易站产物（赤金/搓玉）无关；产物限制只约束本制造站贵金属配方
            const tradeCount = this.layout.TRADING?.length || 0;
            const per = bid === 'manu_prod_spd&trade[1000]' ? 3 : 20;
            const eff = tradeCount * per;
            extraEfficiency += eff;
            skill.actualEfficiency = eff;
            skill._isFacilityCountBonus = true;
            skill.desc = `每个贸易站+${per}% (贸易站数: ${tradeCount}, 当前: +${eff}%)`;
          }
          applied = true;
        }

        // --- 阿兰娜 - 机械精通（按发电站作业平台数，设施数量类）---
        else if (bid.startsWith('manu_token_prod_spd')) {
          if (stats.product !== 'GOLD') {
            skill.actualEfficiency = 0;
            skill.desc = '[产物不匹配] ' + skill.desc;
          } else {
            const tokenCount = this.getWorkPlatformCountInPower();
            const per = bid === 'manu_token_prod_spd[010]' ? 10 : 5;
            const eff = tokenCount * per;
            extraEfficiency += eff;
            skill.actualEfficiency = eff;
            skill._isFacilityCountBonus = true;
            skill.desc = skill.desc.replace(/每有1台作业平台进驻发电站，贵金属类配方的生产力\+\d+\%/, `每台作业平台+${per}% (作业平台数: ${tokenCount}, 当前: +${eff}%)`);
          }
          applied = true;
        }

        // --- 阿兰娜 - 搞把手！(温米) ---
        else if (bid === 'manu_prod_spd_double[000]') {
          const hasWarmy = charNames.includes('温米') && stats.product === 'GOLD';
          skill.actualEfficiency = hasWarmy ? 15 : 0;
          if (hasWarmy) extraEfficiency += 15;
          if (!hasWarmy) skill.desc = skill.desc.replace(/当与温米在同一个制造站时/, `(未生效: 需温米在局且产物为贵金属)`);
          applied = true;
        }

        // 红云 - 回收利用（与泡泡互斥，泡泡优先生效）
        if (bid === 'manu_prod_spd_variable[000]' || bid === 'manu_prod_spd_P[008]') {
          const hasBubble = buffEffects.some(e => e.skill.buffId === 'manu_prod_spd_variable3[000]');
          if (hasBubble) {
            skill.actualEfficiency = 0;
            skill.desc = '[被泡泡优先生效覆盖] ' + skill.desc;
          } else {
            const extraCap = stats.capacity - this.getRoomCapacity('MANUFACTURE', stats.level);
            const eff = extraCap * 2;
            extraEfficiency += eff;
            skill.actualEfficiency = eff;
          }
          applied = true;
        }
        // 槐琥 - 团队精神 / 配合意识（配合意识数值在自动化后处理里结算）
        else if (bid === 'manu_cost_all[000]') {
          skill.actualEfficiency = 0;
          skill._nullifySelfMood = true;
          skill.desc = '团队精神：已消除本站所有干员自身心情消耗技能的影响';
          applied = true;
        }
        else if (bid === 'manu_prod_spd_variable2[000]') {
          skill.actualEfficiency = 0; // 占位，阶段3按其他干员结算
          applied = true;
        }
        // 水月 - 意识兼容：莱茵/红松视作标准化（仅标记）
        else if (bid === 'manu_skill_change[000]') {
          skill.actualEfficiency = 0;
          skill._standardCompat = true;
          applied = true;
        }
        // 苍苔/水月/多萝西：按站内「类技能」数量给自身生产力
        else if (bid === 'manu_skill_spd1[000]' || bid === 'manu_skill_spd1[010]' || bid === 'manu_skill_spd1[020]') {
          const hasCompat = buffEffects.some(e =>
            e.skill.buffId === 'manu_skill_change[000]' || e.skill._standardCompat);
          let n = 0;
          const names = [];
          for (const e of buffEffects) {
            const fam = this.getManuSkillFamily(e.skill);
            if (!fam) continue;
            let hit = false;
            if (bid === 'manu_skill_spd1[020]') hit = fam === 'metal';
            else if (bid === 'manu_skill_spd1[010]') hit = fam === 'rhine';
            else if (bid === 'manu_skill_spd1[000]') {
              hit = fam === 'standard' || (hasCompat && (fam === 'rhine' || fam === 'pinus'));
            }
            if (hit) {
              n += 1;
              const op = BUILDING_DATA.chars[e.charId]?.name || '';
              names.push(`${op}·${e.skill.name}`);
            }
          }
          const eff = n * 5;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          const kind = bid === 'manu_skill_spd1[020]' ? '金属工艺'
            : bid === 'manu_skill_spd1[010]' ? '莱茵科技' : '标准化';
          skill.desc = n
            ? `${skill.name}：${kind}×${n}（${names.join('、')}）→ +${eff}%`
            : `${skill.name}：站内无${kind}类技能 → +0%`;
          applied = true;
        }
        // 泡泡 - 大就是好！：按每位干员各自提供的库容分别套 1%/格 或 3%/格
        else if (bid === 'manu_prod_spd_variable3[000]') {
          let eff = 0;
          const parts = [];
          for (const opId of charIds) {
            let opCap = 0;
            for (const s of this.getActiveSkills(opId)) {
              if (s.roomType === 'MANUFACTURE' && typeof s.capacity === 'number') opCap += s.capacity;
            }
            if (opCap <= 0) continue;
            const rate = opCap > 16 ? 3 : 1;
            const add = opCap * rate;
            eff += add;
            const opName = BUILDING_DATA.chars[opId]?.name || opId;
            parts.push(`${opName}+${opCap}×${rate}%`);
          }
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = parts.length
            ? `大就是好！：${parts.join('；')} = +${eff}%`
            : `大就是好！：无人提供库容 → +0%`;
          applied = true;
        }
        // 玛露西尔 - 意想不到的美味：每点魔物料理 +1%
        else if (bid === 'manu_prod_spd_bd[400]') {
          const food = this.getMonsterCuisineCount();
          const eff = food * 1;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `意想不到的美味：魔物料理 ${food} 点 → +${eff}%（森西进宿舍，宿舍等级=层数）`;
          applied = true;
        }
        // 至简 - 绘图设计
        else if (bid === 'manu_constrLv[000]') {
          skill.actualEfficiency = 0; // 只加机制，不加生产力
          applied = true;
        }
        // 至简 - 机械辅助
        else if (bid === 'manu_prod_spd_bd[100]' || bid === 'manu_prod_spd_bd[110]') {
          const allLevels = this.getFacilityTotalLevel(null) + 3; 
          const robots = Math.min(64, allLevels);
          const divisor = bid === 'manu_prod_spd_bd[110]' ? 8 : 16;
          const eff = Math.floor(robots / divisor) * 5;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        // 怪猎 - 调查团
        else if (charName === '泰拉大陆调查团') {
          const catnip = this.getCatnipCount();
          skill.actualEfficiency = 5 + (catnip * 1);
          extraEfficiency += skill.actualEfficiency;
          applied = true;
        }
        // 随时间递增类技能
        else if (bid === 'manu_prod_spd_addition[030]' || bid === 'manu_prod_spd_addition[031]') {
          // 首小时20%，之后+1%/h，满25%
          const eff = Math.min(25, 20 + Math.floor(hoursPassed) * 1);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        else if (bid === 'manu_prod_spd_addition[040]' || bid === 'manu_prod_spd_addition[041]') {
          // 首小时15%，之后+2%/h，满25%
          const eff = Math.min(25, 15 + Math.floor(hoursPassed) * 2);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        // 阿罗玛 - 例行清扫：每小时+2%，封顶+20%（从进驻起算，满心情≈0h）
        else if (bid === 'manu_prod_spd_addition[100]') {
          const eff = Math.min(20, Math.floor(hoursPassed) * 2);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `例行清扫：已工作约 ${hoursPassed.toFixed(1)}h → +${eff}%（每小时+2%，封顶20%；拖心情条可模拟）`;
          applied = true;
        }
        // 机械师 - 「我睡过了」：单次工作满 12h 才 +10%
        else if (bid === 'manu_prod_cost_min[001]') {
          const eff = hoursPassed >= 12 ? 10 : 0;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = hoursPassed >= 12
            ? `“我睡过了”：已工作约 ${hoursPassed.toFixed(1)}h ≥12h → +10%`
            : `“我睡过了”：已工作约 ${hoursPassed.toFixed(1)}h（未满12h，未生效；拖心情条可模拟）`;
          applied = true;
        }
        // Miss.Christine - 盛餐的回报
        else if (bid === 'manu_prod_spd_double[100]') {
          if (charNames.includes('酒神') && stats.product === 'EXP') {
            extraEfficiency += 30;
            skill.actualEfficiency = 30;
          } else {
            skill.actualEfficiency = 0;
            if (!charNames.includes('酒神')) {
              skill.desc = skill.desc.replace(/当与酒神在同一个制造站时/, `当与酒神在同一个制造站时 (未生效)`);
            }
          }
          applied = true;
        }
        // 娜仁图亚 - 齐心沙盗：每间宿舍每级 +1% 贵金属
        else if (bid === 'manu_formula_spd&dorm&lv[000]') {
          const dormLv = this.getDormLevelSum();
          const eff = dormLv * 1;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `齐心沙盗：宿舍等级合计 ${dormLv} → +${eff}%`;
          applied = true;
        }
        // 娜斯提 - 造价高昂：基建内莱茵生命最多5人，每人+3%贵金属
        else if (bid === 'manu_formula_spd&cost_bd[100]') {
          const n = Math.min(5, this.getFactionCountGlobal('RHINE_LAB'));
          const eff = n * 3;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `造价高昂：莱茵生命 ${n}/5（不含会客/训练）→ +${eff}%`;
          applied = true;
        }
        // 杏仁 - 挑大梁：基建内黑钢最多3人，每人+2%贵金属
        else if (bid === 'manu_formula_spd&cost_bd[000]') {
          const n = Math.min(3, this.getFactionCountGlobal('BLACKSTEEL'));
          const eff = n * 2;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `挑大梁：黑钢国际 ${n}/3（不含会客/训练）→ +${eff}%`;
          applied = true;
        }
        // 维伊 - 手艺人：训练室每级+10%，最多30%
        else if (bid === 'manu_prod_spd_train&lv[000]') {
          const trainLv = this.layout.TRAINING?.[0]?.level || 0;
          const eff = Math.min(30, trainLv * 10);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `手艺人：训练室 Lv${trainLv} → +${eff}%（封顶30%）`;
          applied = true;
        }
        // 烈夏 - 患难拍档：古米必须在贸易站才 +35% 作战记录
        else if (bid === 'manu_formula_spd_P[000]') {
          const ok = this.hasGumiInTrading();
          const eff = ok ? 35 : 0;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = ok
            ? `患难拍档：古米在贸易站 → +35%`
            : `患难拍档：古米未在贸易站 → 不生效`;
          applied = true;
        }
        // 怒潮凛冬 - 战阵领袖 / 情同手足
        else if (bid === 'manu_formula_spd&bd[000]' || bid === 'manu_formula_spd&bd[001]') {
          let eff = 30;
          let partner = false;
          if (bid === 'manu_formula_spd&bd[001]') {
            const ursus = BaseEngine.FACTIONS.URSUS_STUDENT;
            partner = charNames.some(n => ursus.includes(n));
            if (partner) eff += 10;
          }
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = bid === 'manu_formula_spd&bd[001]'
            ? (partner
              ? `情同手足：+30%，同站乌萨斯学生自治团 → 额外+10% = +${eff}%`
              : `情同手足：+30%（同站无乌萨斯学生自治团，未触发+10%）`)
            : `战阵领袖：+30%`;
          applied = true;
        }
      }
      
      // --- 发电站联动 ---
      if (roomType === 'POWER') {
        if (bid === 'power_rec_spd&addition[000]') {
          // 空构：首小时10%，+1%/h，满15%
          const eff = Math.min(15, 10 + Math.floor(hoursPassed) * 1);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        else if (bid === 'power_rec_spd&addition[001]') {
          // 空构 精二：首小时15%，+1%/h，满20%
          const eff = Math.min(20, 15 + Math.floor(hoursPassed) * 1);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          applied = true;
        }
        // --- 承曦格雷伊 - 巡线框架 ---
        else if (bid === 'power_rec_drone[000]') {
          const droneLimit = this.getDroneLimit();
          const eff = Math.min(25, Math.floor(droneLimit / 10));
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = skill.desc.replace(
            /每10架无人机上限\+1%无人机充能速度（最多\+25%）/,
            `每10架上限+1% (无人机上限: ${droneLimit}, 当前: +${eff}%)`
          );
          applied = true;
        }
        // --- 承曦格雷伊 - 晨曦（仅影响设施数量，不提供充能）---
        else if (bid === 'power_count[000]') {
          const roomIdx = stats.roomIdx;
          const otherTokens = this.getWorkPlatformCountInPower(
            roomIdx !== undefined ? roomIdx : null
          );
          const active = otherTokens === 0;
          skill.actualEfficiency = 0;
          skill._virtualPowerBonus = active ? 1 : 0;
          if (active) {
            skill.desc = `进驻发电站时，其他发电站无作业平台 → 发电站额外+1(仅影响设施数量) (已生效, 有效发电站数: ${this.getEffectivePowerCount()})`;
          } else {
            skill.desc = `进驻发电站时，发电站额外+1(仅影响设施数量) (未生效: 其他发电站有 ${otherTokens} 台作业平台)`;
          }
          applied = true;
        }
      }
      
      // --- 会客室联动 ---
      if (roomType === 'MEETING') {
        const desc0 = skill.desc || '';

        if (bid === 'meet_spd_hast[000]') {
          // 伊内丝聚影：进驻即 +20%，此后每工作 1 小时 +2%，5 小时后满 +30%
          const worked = Math.floor(hoursPassed);
          const eff = Math.min(30, 20 + worked * 2);
          const toPeak = Math.max(0, 5 - worked);
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = eff >= 30
            ? `聚影：线索速度 +${eff}%（已工作约 ${hoursPassed.toFixed(1)}h，已满）`
            : `聚影：线索速度 +${eff}%（已工作约 ${hoursPassed.toFixed(1)}h，+2%/h，约 ${toPeak}h 后满 30%）`;
          applied = true;
        }
        // 双月 - 情报专家：+5% + 每点情报储备+5%（配彩虹中枢永动）
        else if (bid === 'meet_spd_bd[000]') {
          const intel = this.getIntelReserveCount();
          const eff = 5 + intel * 5;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `情报专家：+5% + 情报储备${intel}×5% = +${eff}%${intel < 4 ? '（满配彩虹中枢灰烬可到4点→+25%）' : '（满配）'}`;
          applied = true;
        }
        // 莱欧斯 - 饱餐的干劲：每点魔物料理+2%（配森西宿舍）
        else if (bid === 'meet_spd_bd[001]') {
          const food = this.getMonsterCuisineCount();
          const eff = food * 2;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `饱餐的干劲：魔物料理${food}×2% = +${eff}%${food < 5 ? '（森西进Lv5宿舍可达5层→+10%）' : ''}`;
          applied = true;
        }
        // 赤刃明霄陈 - 扶危行侠：+20% + 每10点人间烟火+1%
        else if (bid === 'meet_spd_bd[002]') {
          const fire = this.getHumanFireworksCount();
          const extra = Math.floor(fire / 10) * 1;
          const eff = 20 + extra;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `扶危行侠：+20% + 人间烟火${fire}→+${extra}% = +${eff}%`;
          applied = true;
        }
        // 信仰搅拌机 - 不泯童心：菲亚梅塔在宿舍时额外+10%
        else if (bid === 'meet_spd_ext&P[000]') {
          const ok = this.hasOperatorInRoomType('菲亚梅塔', 'DORMITORY');
          const eff = ok ? 10 : 0;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = ok
            ? `不泯童心：菲亚梅塔在宿舍 → +10%`
            : `不泯童心：菲亚梅塔未在宿舍 → 不生效`;
          applied = true;
        }
        // 忍冬 - 杀手的假期：与铃兰同站 +30%
        else if (bid === 'meet_spd&bd[100]') {
          const ok = charNames.includes('铃兰');
          const eff = ok ? 30 : 0;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = ok
            ? `杀手的假期：铃兰同站 → +30%`
            : `杀手的假期：需铃兰同站 → 不生效`;
          applied = true;
        }
        // 骋风 - 广交义友：每额外招募位 +5%
        else if (bid === 'meet_spd&clue[000]') {
          const slots = this.getExtraRecruitSlots();
          const eff = slots * 5;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          skill.desc = `广交义友：额外招募位 ${slots} → +${eff}%`;
          applied = true;
        }
        // 线索交流类：跃跃/响石默认视为交流中；其余默认非交流（倾向技无速度）
        else if (bid.startsWith('meet_spd&exchange') || bid === 'meet_spd_notOwned&exchange[000]') {
          const m = desc0.match(/线索搜集速度提升(\d+(?:\.\d+)?)%/);
          const peak = m ? +m[1] : 0;
          const charName = BUILDING_DATA.chars[charId]?.name;
          const defaultOn = charName === '跃跃' || charName === '响石';
          if (defaultOn && peak > 0) {
            extraEfficiency += peak;
            skill.actualEfficiency = peak;
            skill.desc = `${skill.name}：默认线索交流中 +${peak}%`;
          } else {
            skill.actualEfficiency = 0;
            skill.desc = peak
              ? `${skill.name}：需处于线索交流才 +${peak}%（当前未计入）`
              : `${skill.name}：线索交流倾向（不影响速度数值）`;
          }
          applied = true;
        }
        // 哈洛德 / mustget：无速度数值
        else if (bid === 'meet_team&char[000]' || bid.startsWith('meet_spd&condChar_mustget')) {
          skill.actualEfficiency = 0;
          skill.desc = `${skill.name}：线索倾向/保底机制（不提供速度%）`;
          applied = true;
        }
        // 仅自己在会客室时生效的速度技能
        else if (/只有自身处于工作状态/.test(desc0) && /线索搜集速度提升/.test(desc0)) {
          const alone = charIds.length === 1 && charIds[0] === charId;
          const m = desc0.match(/线索搜集速度提升(\d+(?:\.\d+)?)%/);
          const soloEff = m ? +m[1] : 0;
          if (alone) {
            extraEfficiency += soloEff;
            skill.actualEfficiency = soloEff;
            skill.desc = `${skill.name}：独处生效 +${soloEff}%`;
          } else {
            skill.actualEfficiency = 0;
            skill.desc = `${skill.name}：需独处才生效 (当前${charIds.length}人，未生效，独处可达+${soloEff}%)`;
          }
          applied = true;
        }
        // 标准「线索搜集速度提升X%」+ 同站/系列额外
        else if (/线索搜集速度提升(\d+(?:\.\d+)?)%/.test(desc0)) {
          const m = desc0.match(/线索搜集速度提升(\d+(?:\.\d+)?)%/);
          let eff = m ? +m[1] : (skill.efficiency || 0);
          const extraM = desc0.match(/额外提升(\d+(?:\.\d+)?)%/);
          let extra = 0;
          let extraNote = '';
          if (extraM && /与其他|当与|一起工作/.test(desc0)) {
            const want = +extraM[1];
            let ok = false;
            if (/与其他萨米干员/.test(desc0)) {
              const n = this.getFactionCount('MEETING', 0, 'SAMI');
              ok = n >= 2;
              extraNote = ok ? `萨米同站${n}人` : '需其他萨米同站';
            } else if (/与其他黑钢国际干员/.test(desc0)) {
              const n = this.getFactionCount('MEETING', 0, 'BLACKSTEEL');
              ok = n >= 2;
              extraNote = ok ? `黑钢同站${n}人` : '需其他黑钢同站';
            } else if (/当与提丰/.test(desc0)) {
              ok = charNames.includes('提丰');
              extraNote = ok ? '提丰同站' : '需提丰同站';
            } else if (/当与铃兰/.test(desc0)) {
              ok = charNames.includes('铃兰');
              extraNote = ok ? '铃兰同站' : '需铃兰同站';
            } else {
              extraNote = `条件额外+${want}%未识别搭档规则`;
            }
            if (ok) {
              extra = want;
              extraNote += ` → +${want}%`;
            } else if (!extraNote.includes('未识别')) {
              extraNote += `（未触发+${want}%）`;
            }
          }
          eff += extra;
          extraEfficiency += eff;
          skill.actualEfficiency = eff;
          if (extraNote) {
            skill.desc = `${skill.name}：+${eff - extra}%${extra ? ` + 额外${extra}%` : ''}（${extraNote}）= +${eff}%`;
          }
          applied = true;
        }
        // 纯倾向/机制：无速度
        else if (/更容易获得|线索倾向|线索板上尚未拥有|提升会客室内另一干员所属派系/.test(desc0)) {
          skill.actualEfficiency = 0;
          skill.desc = `${skill.name}：线索倾向/机制（不提供速度%）`;
          applied = true;
        }
      }

      // --- 控制中枢联动 ---
      if (roomType === 'CONTROL') {
        // 彩虹/异格者：持有者技能可叠加；计数对象为「中枢内对应派系/异格干员」
        if (bid === 'control_mp_cost&faction[990]' || bid === 'control_mp_cost&faction[900]') {
          const isR6 = bid === 'control_mp_cost&faction[990]';
          const factionCount = isR6
            ? charIds.filter(id => ['灰烬', '闪击', '战车', '霜华'].includes(BUILDING_DATA.chars[id]?.name)).length
            : charIds.filter(id => this.isAlterOperator(id)).length;
          const reduce = factionCount * 0.05;
          stats.moodCost -= reduce;
          skill.actualEfficiency = 0;
          skill._moodReduce = reduce;
          skill.desc = isR6
            ? `彩虹小队：本中枢心情消耗 -${reduce.toFixed(2)}/h（中枢内彩虹 ${factionCount} 人×0.05；仅本技能持有者结算，可叠加）`
            : `异格者：本中枢心情消耗 -${reduce.toFixed(2)}/h（中枢内异格 ${factionCount} 人×0.05；仅本技能持有者结算，可叠加）`;
          applied = true;
        }
        // 灰烬情报储备 / 战车乌萨斯特饮：机制技
        else if (bid === 'control_mp_bd[000]') {
          const intel = this.getIntelReserveCount();
          skill.actualEfficiency = 0;
          skill.desc = `情报储备：中枢内每名彩虹干员 +1 层（当前 ${intel}；供会客双月等使用）`;
          applied = true;
        } else if (bid === 'control_mp_bd[010]') {
          skill.actualEfficiency = 0;
          skill.desc = `乌萨斯特饮：机制计数（不直接改心情/效率）`;
          applied = true;
        }
      }

      // 如果未被特殊规则拦截，则加上它原本的基础效率
      if (!applied && typeof skill.efficiency === 'number' && skill.efficiency !== 0) {
        // 修补 data.js 抓取异常：如果制造站技能描述中不含“生产”或“效率”，说明 efficiency 是从“仓库容量”错误解析来的，应当归零
        const desc = skill.desc || '';
        if (roomType === 'MANUFACTURE' && !desc.includes('生产') && !desc.includes('效率') && !desc.includes('配方')) {
          skill.actualEfficiency = 0;
        } else {
          extraEfficiency += skill.efficiency;
          skill.actualEfficiency = skill.efficiency;
        }
      }
    }

    // ==========================================
    // 阶段3：处理全局Buff（如控制中枢阿米娅加成）
    // ==========================================
    // 【自动化体系后处理】：清零他人常规生产力，但保留“根据设施数量提供加成”的生产力
    // （温蒂/森蚺文案：不含设施数量类 —— 如自动化自身、清流再生能源、阿兰娜机械精通）
    if (roomType === 'MANUFACTURE') {
      const hasAutoReset = buffEffects.some(e => e.skill._triggersAutoReset);
      if (hasAutoReset) {
        for (const { skill } of buffEffects) {
          if (skill._triggersAutoReset || this.isFacilityCountProdBonus(skill)) continue;
          const wasContributing = (skill.actualEfficiency !== undefined ? skill.actualEfficiency : skill.efficiency);
          if (wasContributing && wasContributing !== 0) {
            extraEfficiency -= wasContributing;
            skill.actualEfficiency = 0;
            skill.desc = '[自动化覆盖，已清零] ' + skill.desc;
          }
        }
      }

      // 【槐琥·配合意识】：抄其他干员生产力（放在自动化清零之后）
      // 官方「不包含根据设施数量提供加成」= 按发电站/贸易站/作业平台计数的技能
      // （自动化、清流、引星棘刺、阿兰娜机械精通等）。至简机械辅助按工程机器人，会抄。
      for (const { charId, skill } of buffEffects) {
        if (skill.buffId !== 'manu_prod_spd_variable2[000]') continue;
        let others = 0;
        for (const e of buffEffects) {
          if (e.charId === charId) continue;
          if (this.isFacilityCountProdBonus(e.skill)) continue;
          const ae = e.skill.actualEfficiency !== undefined ? e.skill.actualEfficiency : 0;
          others += ae;
        }
        const eff = Math.min(40, Math.floor(Math.max(0, others) / 5) * 5);
        const prev = skill.actualEfficiency || 0;
        extraEfficiency += eff - prev;
        skill.actualEfficiency = eff;
        skill.desc = `配合意识：其他干员生产力合计 ${others}% → +${eff}%（每5%→+5%，封顶40%；不含发电/贸易/作业平台类）`;
      }
    }

    // 【巫恋·低语】：其他干员提供的订单获取效率全部归零（不含订单品质/投资收益折算）
    if (roomType === 'TRADING') {
      const hasWhisper = buffEffects.some(e => e.skill._triggersWhisperReset);
      if (hasWhisper) {
        for (const { skill } of buffEffects) {
          if (skill._triggersWhisperReset) continue;
          if (skill._tequilaBonus || skill._hqTier || skill._isOrderValueBonus) continue;
          const was = skill.actualEfficiency !== undefined ? skill.actualEfficiency : skill.efficiency;
          if (was && was !== 0) {
            extraEfficiency -= was;
            skill.actualEfficiency = 0;
            skill.desc = '[低语覆盖，已清零] ' + skill.desc;
          }
        }
      }
    }

    // 【赤金订单品质 / 龙舌兰投资 / 但书违约】
    // 只改每单龙门币（及赤金消耗），不改获取速度；另存 lmdValueMult 展示。
    if (roomType === 'TRADING' && (stats.product || 'GOLD') === 'GOLD') {
      const force2 = buffEffects.some(e => e.skill._forceGold2);
      const noBreach = buffEffects.some(e => e.skill._noBreach); // U-Official：固定2金且不视作违约
      const dist = force2
        ? { 2: 1, 3: 0, 4: 0, tier: 'force2' }
        : this.getGoldOrderDistribution(stats.level, buffEffects);
      const baseDist = this.getGoldOrderDistribution(stats.level, []);
      const refLmd = this.avgGoldOrderLmd(baseDist);

      const butuLaw = buffEffects.some(e => e.skill._butuLaw);
      const againstSkill = buffEffects.find(e => e.skill._butuAgainst);
      const againstExtra = (!noBreach && butuLaw && againstSkill) ? againstSkill.skill._butuAgainst : 0;

      // 但书：非4金订单视为违约，交付赤金 +againstExtra → 龙门币按 500×交付数
      // 4金订单不受合同法影响；U-Official 固定2金且不视作违约时索赔不生效
      let avgLmd;
      if (againstExtra > 0) {
        const pay2 = 500 * (2 + againstExtra);
        const pay3 = 500 * (3 + againstExtra);
        const pay4 = 2000; // 4金非违约
        avgLmd = pay2 * (dist[2] || 0) + pay3 * (dist[3] || 0) + pay4 * (dist[4] || 0);
      } else {
        avgLmd = this.avgGoldOrderLmd(dist);
      }

      const tequilaSkill = buffEffects.find(e => e.skill._tequilaBonus);
      // 龙舌兰：仅非违约的4金订单；有但书时4金仍非违约，可共存但相性差（高品质会削弱但书）
      const tequilaBonus = tequilaSkill?.skill._tequilaBonus || 0;
      const teqLmd = (dist[4] || 0) * tequilaBonus;
      avgLmd += teqLmd;

      const valueMult = refLmd > 0 ? avgLmd / refLmd : 1;
      stats.goldOrderDist = dist;
      stats.goldOrderRefLmd = refLmd;
      stats.goldOrderAvgLmd = avgLmd;
      stats.lmdValueMult = valueMult;
      stats.butuAgainst = againstExtra;

      const pct = (n) => `${Math.round((dist[n] || 0) * 100)}%`;
      const hqSkills = buffEffects.filter(e => e.skill._hqTier);
      if (hqSkills.length) {
        hqSkills.sort((a, b) => (b.skill._hqTier === 'beta' ? 1 : 0) - (a.skill._hqTier === 'beta' ? 1 : 0));
        const best = hqSkills[0];
        const hqLmdOnly = this.avgGoldOrderLmd(dist);
        const hqMult = refLmd > 0 ? hqLmdOnly / refLmd : 1;
        if (stats.level < 3) {
          best.skill.actualEfficiency = 0;
          best.skill.desc = `${best.skill.name}：高品质仅影响3级站4金池 (当前Lv${stats.level})`;
        } else {
          best.skill.actualEfficiency = 0;
          best.skill._isOrderValueBonus = true;
          const warn = againstExtra > 0 ? '；注意：抬高4金会削弱但书违约覆盖' : '';
          best.skill.desc = `${best.skill.name}：抬高4金权重 → ${pct(2)}/${pct(3)}/${pct(4)}，单均×${hqMult.toFixed(2)}${warn}`;
        }
        for (let i = 1; i < hqSkills.length; i++) {
          hqSkills[i].skill.actualEfficiency = 0;
          hqSkills[i].skill.desc = `${hqSkills[i].skill.name}：高品质权重不与更高档叠加`;
        }
      }

      if (tequilaSkill) {
        const t = tequilaSkill.skill;
        t.actualEfficiency = 0;
        if (stats.level < 3 || (dist[4] || 0) <= 0) {
          t.desc = `${t.name}：需3级贸易站且出现4金订单 (当前Lv${stats.level}，4金 ${pct(4)})`;
        } else {
          t._isOrderValueBonus = true;
          const share = avgLmd > 0 ? teqLmd / avgLmd : 0;
          t.desc = `${t.name}：4金+${tequilaBonus}龙门币 (4金 ${pct(4)}，约占单均 ${Math.round(share * 100)}%)`;
        }
      }

      const lawSkill = buffEffects.find(e => e.skill._butuLaw);
      if (lawSkill) {
        lawSkill.skill.actualEfficiency = 0;
        lawSkill.skill._isOrderValueBonus = true;
        if (noBreach) {
          lawSkill.skill.desc = `合同法：当前有「不视作违约」效果，无法标记违约订单`;
        } else {
          const breachRate = ((dist[2] || 0) + (dist[3] || 0));
          lawSkill.skill.desc = `合同法：非4金视为违约 (当前违约覆盖 ${Math.round(breachRate * 100)}%，2/3/4金 ${pct(2)}/${pct(3)}/${pct(4)})`;
        }
      }
      if (againstSkill) {
        const a = againstSkill.skill;
        a.actualEfficiency = 0;
        a._isOrderValueBonus = true;
        if (againstExtra <= 0) {
          a.desc = `${a.name}：未触发（需合同法且订单可被标为违约）`;
        } else {
          a.desc = `${a.name}：违约订单交付+${againstExtra} (单均龙门币 ${Math.round(avgLmd)}，相对基础 ×${valueMult.toFixed(2)}，赤金消耗大增)`;
        }
      }
    }

    const globals = this.getGlobalBuffs(roomType, stats);
    for (const effect of globals) {
      buffEffects.push(effect);
      extraEfficiency += effect.skill.actualEfficiency || 0;
    }

    stats.efficiency += extraEfficiency;
    // 龙门币产速等效 = 获取速度 × 单均收益倍率（仅展示，不写回 efficiency）
    if (roomType === 'TRADING' && stats.lmdValueMult) {
      stats.lmdEquivalentEff = Math.round(stats.efficiency * stats.lmdValueMult * 10) / 10;
    }
    // 控制中枢不会回复心情：减免叠到负数时强制为 0（永动 = 不掉，而非回心情）
    if (roomType === 'CONTROL' && stats.moodCost < 0) {
      stats.moodCost = 0;
    }
    return stats;
  }

  /** 写入每人消耗，房间 moodCost 取最高（木桶） */
  attachOperatorMoodDrains(roomType, roomIdx, stats, buffEffects) {
    const drains = this.getOperatorMoodDrains(roomType, roomIdx, buffEffects);
    stats.operatorMoodDrains = drains;
    const vals = Object.values(drains);
    if (vals.length) {
      stats.moodCostMax = Math.round(Math.max(...vals) * 1000) / 1000;
      stats.moodCostMin = Math.round(Math.min(...vals) * 1000) / 1000;
      stats.moodCost = stats.moodCostMax;
    }
    return stats;
  }

  // 制造站
  calcManufacture(roomIdx) {
    const room = this.layout.MANUFACTURE?.[roomIdx];
    if (!room) return null;
    const { level, operators: ops, product } = room;

    const buffEffects = this.collectBuffEffects('MANUFACTURE', ops);
    
    // 初始状态
    let stats = {
      level, operators: ops, product: product || 'GOLD', roomIdx,
      efficiency: 100 + ops.length, // 基础100% + 每人1%
      moodCost: this.calcMoodCost('MANUFACTURE', ops.length),
      capacity: this.getRoomCapacity('MANUFACTURE', level),
    };

    // 应用联动解析
    stats = this.resolveSynergy('MANUFACTURE', ops, buffEffects, stats);
    stats = this.attachOperatorMoodDrains('MANUFACTURE', roomIdx, stats, buffEffects);

    return {
      ...stats,
      efficiency: Math.round(stats.efficiency * 10) / 10,
      moodCost: Math.round(stats.moodCost * 100) / 100,
      buffEffects,
    };
  }

  // 贸易站
  calcTrading(roomIdx) {
    const room = this.layout.TRADING?.[roomIdx];
    if (!room) return null;
    const { level, operators: ops, product } = room;

    const buffEffects = this.collectBuffEffects('TRADING', ops);
    
    // 初始状态
    const orderLimits = [6, 8, 10];
    let stats = {
      level, operators: ops, product: product || 'GOLD', roomIdx,
      efficiency: 100 + ops.length,
      moodCost: this.calcMoodCost('TRADING', ops.length),
      capacity: this.getRoomCapacity('TRADING', level),
      orderLimit: orderLimits[level - 1] || 10,
    };

    // 应用联动解析
    stats = this.resolveSynergy('TRADING', ops, buffEffects, stats);
    stats = this.attachOperatorMoodDrains('TRADING', roomIdx, stats, buffEffects);

    return {
      ...stats,
      efficiency: Math.round(stats.efficiency * 10) / 10,
      moodCost: Math.round(stats.moodCost * 100) / 100,
      buffEffects,
    };
  }

  // 发电站
  calcPower(roomIdx) {
    const room = this.layout.POWER?.[roomIdx];
    if (!room) return null;
    const { level, operators: ops } = room;

    const powerOutput = [60, 130, 270][level - 1] || 270;
    const buffEffects = this.collectBuffEffects('POWER', ops);

    let stats = {
      level, operators: ops, roomIdx,
      powerOutput,
      capacity: this.getRoomCapacity('POWER', level),
      efficiency: ([15, 20, 25][level - 1] || 25) + ops.length * 5, // 基础充能
      moodCost: this.calcMoodCost('POWER', ops.length),
    };

    stats = this.resolveSynergy('POWER', ops, buffEffects, stats);
    stats = this.attachOperatorMoodDrains('POWER', roomIdx, stats, buffEffects);

    return {
      ...stats,
      droneRecharge: Math.round(stats.efficiency * 10) / 10,
      moodCost: Math.round(stats.moodCost * 100) / 100,
      buffEffects,
    };
  }

  // 宿舍
  calcDormitory(roomIdx) {
    const room = this.layout.DORMITORY?.[roomIdx];
    if (!room) return null;
    const { level, operators: ops } = room;

    // 基础: 1.5 + 0.1*level + 氛围加成
    // 满氛围(level*1000): 氛围加成 = level*1000*0.0004
    const comfortMax = level * 1000;
    const baseRecovery = 1.5 + 0.1 * level + comfortMax * 0.0004;

    const buffEffects = this.collectBuffEffects('DORMITORY', ops);

    // 分类：群体加速(dorm_rec_all) vs 单体加速(dorm_rec_single) vs 自身加速(dorm_rec_oneself)
    // 群体加速：取同种中最高（不叠加同一buffId，但不同来源可叠加分析）
    let groupBonus = 0;
    const seenGroupBuff = new Map(); // buffName -> maxVal

    for (const { skill } of buffEffects) {
      const bid = skill.buffId || '';
      const eff = typeof skill.efficiency === 'number' ? skill.efficiency : 0;
      if (eff === 0) continue;

      if (bid.includes('dorm_rec_all') || bid.includes('control_dorm_rec')) {
        // 群体：同种取最高
        const prev = seenGroupBuff.get(skill.name) || 0;
        if (eff > prev) {
          groupBonus += eff - prev;
          seenGroupBuff.set(skill.name, eff);
        }
      }
      // 单体/自身加速暂不计入群体总量（单独标注）
    }

    const totalRecovery = baseRecovery + groupBonus;

    return {
      level, operators: ops,
      baseRecovery: Math.round(baseRecovery * 100) / 100,
      groupBonus: Math.round(groupBonus * 100) / 100,
      totalRecovery: Math.round(totalRecovery * 100) / 100,
      comfortMax,
      buffEffects,
      capacity: this.getRoomCapacity('DORMITORY', level),
    };
  }

  // 控制中枢
  calcControl() {
    const room = this.layout.CONTROL[0];
    const { level, operators: ops } = room;

    const buffEffects = this.collectBuffEffects('CONTROL', ops);
    const globalMoodReduction = ops.length * 0.05;

    let stats = {
      level, operators: ops,
      capacity: this.getRoomCapacity('CONTROL', level),
      globalMoodReduction: Math.round(globalMoodReduction * 100) / 100,
      efficiency: 0,
      moodCost: this.calcMoodCost('CONTROL', ops.length),
    };

    stats = this.resolveSynergy('CONTROL', ops, buffEffects, stats);
    stats = this.attachOperatorMoodDrains('CONTROL', 0, stats, buffEffects);
    if (stats.moodCost < 0) stats.moodCost = 0;

    return {
      ...stats,
      moodCost: Math.round(stats.moodCost * 100) / 100,
      buffEffects,
    };
  }

  // 办公室
  calcHire() {
    const room = this.layout.HIRE[0];
    const { level, operators: ops } = room;

    const recruitSlots = this.getRecruitSlotCount();
    const extraSlots = this.getExtraRecruitSlots();
    const dormLv = this.getDormLevelSum();
    const baseSpeed = [10, 20, 30][level - 1] || 30;
    let refreshSpeed = baseSpeed;

    const buffEffects = this.collectBuffEffects('HIRE', ops);
    for (const { skill } of buffEffects) {
      const bid = skill.buffId || '';
      const d = skill.desc || '';

      // 锡人：+5% + 宿舍等级合计 ×1%/2%
      if (bid.startsWith('hire_spd_dorm&lv')) {
        const per = bid.includes('[010]') ? 2 : 1;
        const eff = 5 + dormLv * per;
        skill.actualEfficiency = eff;
        skill.desc = `梅兰德侦探：+5% + 宿舍等级合计 ${dormLv}×${per}% = +${eff}%（4×Lv5 满配约 +${5 + 20 * per}%）`;
        refreshSpeed += eff;
        continue;
      }

      // 乌有 / 月禾等同系：联络速度 + 每额外招募位拐会客
      if (/会客室线索/.test(d) && /招募位/.test(d) && /联络速度/.test(d)) {
        const m = d.match(/联络速度\+(\d+(?:\.\d+)?)%/);
        const contact = m ? +m[1] : (skill.efficiency || 35);
        const per = +(d.match(/额外\+(\d+(?:\.\d+)?)%会客室/) || d.match(/额外\+(\d+(?:\.\d+)?)%/) || [])[1] || 5;
        const meetBonus = extraSlots * per;
        skill.actualEfficiency = contact;
        skill._meetingClueBonus = meetBonus;
        skill.desc = `联络速度 +${contact}%；额外招募位 ${extraSlots}（总${recruitSlots}−初始${BaseEngine.INITIAL_RECRUIT_SLOTS}）→ 会客线索 +${meetBonus}%`;
        refreshSpeed += contact;
        continue;
      }

      // 每额外招募位加联络
      if (bid.startsWith('hire_spd_cost&extra') || (/每个招募位/.test(d) && /联络速度/.test(d) && !/会客室|人间烟火|记忆|无声/.test(d))) {
        const per = +(d.match(/\+(\d+(?:\.\d+)?)%人脉/) || d.match(/\+(\d+(?:\.\d+)?)%/) || [])[1] || 10;
        const eff = extraSlots * per;
        skill.actualEfficiency = eff;
        skill.desc = `额外招募位 ${extraSlots} ×${per}% = +${eff}%`;
        refreshSpeed += eff;
        continue;
      }

      // 桑葚：只产人间烟火，不提供联络速度（勿把 efficiency 字段当联络）
      if (bid.startsWith('hire_spd_bd_n1_n1[200]') || (/人间烟火/.test(d) && !/联络速度/.test(d))) {
        const fire = extraSlots * 10;
        skill.actualEfficiency = 0;
        skill.desc = `灾后普查：额外招募位 ${extraSlots} → +${fire} 人间烟火（不提供联络速度）`;
        continue;
      }

      // 絮雨巡游：联络 + 记忆碎片机制
      if (bid.startsWith('hire_spd_bd_n1_n1[100]') || (/记忆碎片/.test(d) && /联络速度/.test(d))) {
        const m = d.match(/联络速度\+(\d+(?:\.\d+)?)%/);
        const contact = m ? +m[1] : (skill.efficiency || 20);
        skill.actualEfficiency = contact;
        skill.desc = `巡游：联络 +${contact}%；额外招募位 ${extraSlots} → 记忆碎片（机制，不计入联络%）`;
        refreshSpeed += contact;
        continue;
      }

      // 纯机制 / 无联络数值
      if ((skill.efficiency || 0) <= 0 && !/联络速度\+/.test(d)) {
        skill.actualEfficiency = 0;
        continue;
      }

      if (typeof skill.efficiency === 'number' && skill.efficiency > 0) {
        skill.actualEfficiency = skill.efficiency;
        refreshSpeed += skill.efficiency;
      }
    }

    // 中枢全局：八幡海铃「可靠伙伴」等联络速度；感染力按加算后是否 <30% 判定
    const globals = this.getGlobalBuffs('HIRE', {
      baseRefreshSpeed: baseSpeed,
      refreshSpeedBeforeInfect: refreshSpeed,
    });
    for (const effect of globals) {
      buffEffects.push(effect);
      const add = effect.skill.actualEfficiency || 0;
      if (add > 0) refreshSpeed += add;
    }

    let stats = {
      level, operators: ops,
      refreshSpeed: Math.round(refreshSpeed),
      baseRefreshSpeed: baseSpeed,
      recruitSlots,
      extraRecruitSlots: extraSlots,
      initialRecruitSlots: BaseEngine.INITIAL_RECRUIT_SLOTS,
      dormLevelSum: dormLv,
      buffEffects,
      capacity: this.getRoomCapacity('HIRE', level),
      moodCost: this.calcMoodCost('HIRE', ops.length),
    };
    return this.attachOperatorMoodDrains('HIRE', 0, stats, buffEffects);
  }

  // 会客室
  calcMeeting() {
    const room = this.layout.MEETING[0];
    const { level, operators: ops } = room;

    const buffEffects = this.collectBuffEffects('MEETING', ops);

    let stats = {
      level, operators: ops,
      capacity: this.getRoomCapacity('MEETING', level),
      friendLimit: [25, 35, 50][level - 1] || 50,
      efficiency: 0,
      moodCost: this.calcMoodCost('MEETING', ops.length),
      meetingLevelBonus: this.getMeetingLevelBonus(level),
      meetingOpBases: [],
    };

    // 设施等级加成（全室共享一项）
    stats.efficiency += stats.meetingLevelBonus;

    // 每名进驻干员：稀有度 + 精英(默认精二) + 非涣散
    for (const charId of ops.filter(Boolean)) {
      const char = BUILDING_DATA.chars[charId];
      if (!char) continue;
      const elite = this.getPreferredElite(charId);
      const rarityB = this.getMeetingRarityBonus(char.rarity);
      const eliteB = this.getMeetingEliteBonus(elite);
      const focusB = BaseEngine.MEETING_FOCUS_BONUS;
      const base = rarityB + eliteB + focusB;
      stats.efficiency += base;
      stats.meetingOpBases.push({
        charId, name: char.name, rarity: char.rarity, elite,
        rarityB, eliteB, focusB, total: base,
      });
    }

    stats = this.resolveSynergy('MEETING', ops, buffEffects, stats);

    // 办公室乌有/月禾：每额外招募位 +5% 会客线索（初始 2 位不含）
    for (const effect of this.getHireMeetingClueBonusEffects()) {
      buffEffects.push(effect);
      stats.efficiency += effect.skill.actualEfficiency || 0;
    }

    stats = this.attachOperatorMoodDrains('MEETING', 0, stats, buffEffects);

    const bonusTotal = stats.efficiency;
    return {
      ...stats,
      clueBonus: Math.round(bonusTotal * 10) / 10,
      clueSpeed: Math.round((100 + bonusTotal) * 10) / 10,
      moodCost: Math.round(stats.moodCost * 100) / 100,
      buffEffects,
    };
  }

  // 训练室
  calcTraining() {
    const room = this.layout.TRAINING[0];
    const { level, operators: ops } = room;

    let trainSpeed = [5, 10, 15][level - 1] || 15;
    const maxMastery = ['M1', 'M2', 'M3'][level - 1] || 'M3';

    const buffEffects = this.collectBuffEffects('TRAINING', ops);
    for (const { skill } of buffEffects) {
      if (skill.buffId === 'train_spd_power_down[000]') { // 乌尔比安 E2
        let count = 0;
        const hunters = ['斯卡蒂', '幽灵鲨', '归溟幽灵鲨', '安哲拉', '乌尔比安', '歌蕾蒂娅', '深巡'];
        for (const rt in this.layout) {
          for (const r of this.layout[rt]) {
            for (const id of r.operators) {
              if (id && BUILDING_DATA.chars[id] && hunters.includes(BUILDING_DATA.chars[id].name)) count++;
            }
          }
        }
        const eff = Math.min(5, count) * 10;
        trainSpeed += eff;
        skill.actualEfficiency = eff;
        skill.desc = skill.desc.replace(/专精技能训练速度\+10\%\（最多生效5名\）/, `专精技能训练速度+10% (最多生效5名，当前场上深海猎人数: ${count}，生效+${eff}%)`);
      }
      else if (typeof skill.efficiency === 'number' && skill.efficiency > 0) {
        trainSpeed += skill.efficiency;
        skill.actualEfficiency = skill.efficiency;
      }
    }

    return {
      level, operators: ops,
      trainSpeed: Math.round(trainSpeed),
      maxMastery,
      buffEffects,
      capacity: this.getRoomCapacity('TRAINING', level),
    };
  }

  // 计算全部
  calcAll() {
    return {
      control:     this.calcControl(),
      manufactures: this.layout.MANUFACTURE.map((_, i) => this.calcManufacture(i)),
      tradings:    this.layout.TRADING.map((_, i) => this.calcTrading(i)),
      powers:      this.layout.POWER.map((_, i) => this.calcPower(i)),
      dormitories: this.layout.DORMITORY.map((_, i) => this.calcDormitory(i)),
      hire:        this.calcHire(),
      meeting:     this.calcMeeting(),
      training:    this.calcTraining(),
    };
  }

  // 干员是否已分配
  isOperatorAssigned(charId) {
    for (const roomType in this.layout) {
      for (let i = 0; i < this.layout[roomType].length; i++) {
        if (this.layout[roomType][i].operators.includes(charId)) {
          return { roomType, roomIdx: i };
        }
      }
    }
    return null;
  }

  // 分配干员
  assignOperator(charId, roomType, roomIdx) {
    this.removeOperator(charId); // 先移除旧位置
    const room = this.layout[roomType]?.[roomIdx];
    if (!room) return false;
    if (room.operators.length >= this.getRoomCapacity(roomType, room.level)) return false;
    room.operators.push(charId);
    return true;
  }

  // 移除干员
  removeOperator(charId) {
    for (const roomType in this.layout) {
      for (const room of this.layout[roomType]) {
        const idx = room.operators.indexOf(charId);
        if (idx !== -1) { room.operators.splice(idx, 1); return true; }
      }
    }
    return false;
  }

  // 设置设施产物
  setRoomProduct(roomType, roomIdx, product) {
    const room = this.layout[roomType]?.[roomIdx];
    if (room) {
      room.product = product;
    }
  }

  // 设置设施等级
  setRoomLevel(roomType, roomIdx, level) {
    const room = this.layout[roomType]?.[roomIdx];
    if (!room) return false;
    room.level = level;
    const cap = this.getRoomCapacity(roomType, level);
    while (room.operators.length > cap) room.operators.pop();
    return true;
  }

  // 修改设施数量
  setRoomCount(roomType, count) {
    const maxCounts = { MANUFACTURE: 5, TRADING: 5, POWER: 3, DORMITORY: 4 };
    count = Math.min(count, maxCounts[roomType] || 1);
    const current = this.layout[roomType] || [];
    while (current.length < count) current.push({ level: 3, operators: [] });
    while (current.length > count) {
      current.pop(); // operators 丢弃（不需要remove，已从尾部移除）
    }
    this.layout[roomType] = current;
  }

  /**
   * 制造站干员双技能筛查（按产物方向 + 技能描述机制分类）
   * 供控制台/UI 逐项测试：engine.auditManufactureSkills()
   */
  auditManufactureSkills() {
    const PRODUCT_LABEL = { GOLD: '赤金', EXP: '经验', ORUNDUM: '搓玉', ANY: '通用' };
    const classifySkill = (skill) => {
      const bid = skill.buffId || '';
      const d = skill.desc || '';
      const product = this.getManufactureSkillProduct(skill) || 'ANY';
      let mech = 'flat'; // 固定加成
      if (/每间宿舍每级|宿舍每级/.test(d)) mech = 'dorm_level';
      else if (/训练室每级/.test(d)) mech = 'train_level';
      else if (/每个贸易站/.test(d)) mech = 'trade_count';
      else if (/每个发电站/.test(d)) mech = 'power_count';
      else if (/作业平台/.test(d)) mech = 'token_in_power';
      else if (/莱茵生命干员/.test(d)) mech = 'faction_rhine';
      else if (/黑钢国际干员/.test(d)) mech = 'faction_blacksteel';
      else if (/乌萨斯学生自治团/.test(d)) mech = 'faction_ursus_student';
      else if (/若古米在贸易站/.test(d)) mech = 'need_gumi_trading';
      else if (/当与温米/.test(d)) mech = 'need_warmy';
      else if (/当与酒神/.test(d)) mech = 'need_dionaea';
      else if (/金属工艺类/.test(d)) mech = 'count_metal_craft';
      else if (/标准化类/.test(d)) mech = 'count_standard';
      else if (/莱茵科技类/.test(d)) mech = 'count_rhine_tech';
      else if (/工程机器人/.test(d)) mech = 'robots';
      else if (/仓库容量/.test(d) && /生产力/.test(d) && (/每格|提升/.test(d))) mech = 'capacity_prod';
      else if (/其他干员提供的每5%/.test(d)) mech = 'copy_others';
      else if (/消除.*心情消耗/.test(d)) mech = 'nullify_mood';
      else if (/首小时|每小时\+\d+%|工作时长达到/.test(d)) mech = 'time_scale';
      else if (/魔物料理|思维链环|巫术结晶|人间烟火|木天蓼|乌萨斯特饮|感知信息/.test(d)) mech = 'counter_resource';
      else if (/生产力全部归零/.test(d)) mech = 'auto_reset';
      else if (/仓库容量上限/.test(d) && !/生产力\+/.test(d)) mech = 'capacity_only';
      else if (typeof skill.efficiency === 'number' && skill.efficiency !== 0) mech = 'flat';
      else mech = 'misc';
      return { buffId: bid, name: skill.name, product, productLabel: PRODUCT_LABEL[product], mech, desc: d, eliteReq: skill.eliteReq };
    };

    const rows = [];
    for (const char of Object.values(BUILDING_DATA.chars || {})) {
      const manuSkills = (char.skills || []).filter(s => s.roomType === 'MANUFACTURE');
      if (!manuSkills.length) continue;
      const active = this.getActiveSkills(char.id).filter(s => s.roomType === 'MANUFACTURE');
      const classified = active.map(classifySkill);
      const products = [...new Set(classified.map(s => s.product))];
      const mechs = [...new Set(classified.map(s => s.mech))];
      // 干员方向：双技能产物标签合并
      let direction = 'ANY';
      if (products.includes('GOLD') && !products.includes('EXP') && !products.includes('ORUNDUM')) direction = 'GOLD';
      else if (products.includes('EXP') && !products.includes('GOLD') && !products.includes('ORUNDUM')) direction = 'EXP';
      else if (products.includes('ORUNDUM') && !products.includes('GOLD') && !products.includes('EXP')) direction = 'ORUNDUM';
      else if (products.some(p => p !== 'ANY')) direction = 'MIXED';
      rows.push({
        name: char.name,
        id: char.id,
        direction,
        directionLabel: PRODUCT_LABEL[direction] || direction,
        skills: classified,
        mechs,
        needsTest: mechs.some(m => m !== 'flat' && m !== 'capacity_only'),
      });
    }
    rows.sort((a, b) => {
      const order = { GOLD: 0, EXP: 1, ORUNDUM: 2, MIXED: 3, ANY: 4 };
      return (order[a.direction] - order[b.direction]) || a.name.localeCompare(b.name, 'zh');
    });
    return rows;
  }

  // ============================================================
  // 电量系统
  // ============================================================

  // 每个设施每级的耗电量
  static POWER_COST = {
    MANUFACTURE: [10, 30, 60],
    TRADING:     [10, 30, 60],
    DORMITORY:   [10, 20, 30, 45, 65], // 5级宿舍耗电65
    HIRE:        [10, 30, 60],
    TRAINING:    [10, 30, 60],
    MEETING:     [10, 30, 60],
    CONTROL:     [0, 0, 0, 0, 0],
    POWER:       [0, 0, 0], // 发电站不耗电
  };

  // 发电站每级的发电量
  static POWER_GEN = [60, 130, 270];

  // 获取单个设施耗电量
  getRoomPowerCost(roomType, level) {
    const table = BaseEngine.POWER_COST[roomType];
    if (!table) return 0;
    return table[Math.min(level - 1, table.length - 1)] || 0;
  }

  // 计算全基建电量收支
  calcPowerBalance() {
    let generated = 0;
    let consumed = 0;
    const detail = [];

    // 发电
    for (const room of this.layout.POWER || []) {
      const gen = BaseEngine.POWER_GEN[Math.min(room.level - 1, 2)] || 270;
      generated += gen;
    }

    // 耗电（除发电站外所有设施）
    for (const [roomType, rooms] of Object.entries(this.layout)) {
      if (roomType === 'POWER') continue;
      for (const room of rooms) {
        const cost = this.getRoomPowerCost(roomType, room.level);
        consumed += cost;
        if (cost > 0) detail.push({ roomType, level: room.level, cost });
      }
    }
    
    // 加工站(WORKSHOP)固定耗电10
    consumed += 10;
    detail.push({ roomType: 'WORKSHOP', level: 3, cost: 10 });

    return {
      generated,
      consumed,
      balance: generated - consumed,
      detail,
    };
  }

  // 导出配置
  exportConfig() {
    return JSON.stringify({ ...this.layout, _moods: this.moods }, null, 2);
  }

  importConfig(jsonStr) {
    try {
      const layout = JSON.parse(jsonStr);
      if (layout.CONTROL && Array.isArray(layout.CONTROL)) {
        // Backward compatibility for mood
        this.moods = layout._moods || {};
        delete layout._moods;
        this.layout = layout;
        return true;
      }
    } catch (e) {
      console.error("Import failed:", e);
    }
    return false;
  }
}

const engine = new BaseEngine();

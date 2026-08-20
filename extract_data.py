#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取明日方舟基建数据，生成 data.js
从 description 字段提取准确的数值
"""

import json, re, os, sys

BUILDING_DATA_PATH = r"C:\Users\yunbii\.gemini\antigravity\brain\da4210a2-cc4e-4f68-8a11-f3ae18d426cb\.system_generated\steps\11\content.md"
CHAR_TABLE_PATH = r"C:\Users\yunbii\.gemini\antigravity\brain\da4210a2-cc4e-4f68-8a11-f3ae18d426cb\.system_generated\steps\33\content.md"
OUTPUT_PATH = r"C:\Users\yunbii\Desktop\mm\data.js"

def load_json_from_md(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    json_start = content.index('{')
    return json.loads(content[json_start:])

def clean_desc(text):
    if not text:
        return ""
    text = re.sub(r'<@[^>]+>', '', text)
    text = re.sub(r'<\/>', '', text)
    text = re.sub(r'<\$[^>]+>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def extract_first_number(desc):
    """从描述中提取第一个数值（+XX% 或 +XX 或 -XX）"""
    # 匹配 +XX% 或 -XX% 或 +XX.XX 或 -XX.XX
    matches = re.findall(r'[+-]\d+\.?\d*', desc)
    if matches:
        try:
            return float(matches[0])
        except:
            return 0
    return 0

def phase_to_elite(phase):
    return {"PHASE_0": 0, "PHASE_1": 1, "PHASE_2": 2}.get(phase, 0)

def get_buff_efficiency(buff_id, buff):
    """获取buff的实际效率值"""
    eff = buff.get('efficiency', 0)
    desc = buff.get('description', '')
    
    # 如果efficiency字段有非零值，直接使用
    if eff != 0:
        return eff
    
    # 否则从description提取
    return extract_first_number(clean_desc(desc))

def get_buff_capacity(desc):
    """从描述中提取上限/容量增减"""
    cleaned = clean_desc(desc)
    # 匹配 "上限+X" "上限-X" "容量+X" "订单+X" "订单数目-X" 等，但不包含“效率”
    if '效率' in cleaned:
        cleaned = cleaned.replace('订单获取效率', '').replace('生产力', '')
    matches = re.search(r'(?:上限|容量|订单|数目)[^\d+-]*([+-]\d+)', cleaned)
    if matches:
        try:
            return int(matches.group(1))
        except:
            return 0
    return 0

def get_buff_mood_cost(desc):
    """提取心情消耗加成/减免，如 '心情每小时消耗-0.25' 或 '+0.3'"""
    cleaned = clean_desc(desc)
    m = re.search(r'心情.*?[消耗|恢复][^\d+-]*([+-]\d+\.?\d*)', cleaned)
    if m:
        try:
            return float(m.group(1))
        except:
            pass
    return 0

def get_buff_display_value(buff_id, buff):
    """获取用于显示的buff效果字符串"""
    desc = buff.get('description', '')
    cleaned = clean_desc(desc)
    # 提取所有数值
    matches = re.findall(r'[+-]\d+\.?\d*', cleaned)
    if matches:
        v = matches[0]
        # 判断单位：含 % 判断为百分比
        if '%' in desc[:desc.index(matches[0].replace('+','').replace('-',''), 0) + 20] if matches[0].replace('+','').replace('-','') in desc else False:
            return f"{v}%"
        return v
    return ''

def main():
    print("Loading building_data.json...")
    building = load_json_from_md(BUILDING_DATA_PATH)
    
    print("Loading character_table.json...")
    char_table = load_json_from_md(CHAR_TABLE_PATH)
    
    buffs = building.get("buffs", {})
    chars_building = building.get("chars", {})
    
    print(f"Buffs: {len(buffs)}, Chars: {len(chars_building)}")
    
    # === 1. 处理 Buff 数据 ===
    processed_buffs = {}
    for buff_id, buff in buffs.items():
        desc_raw = buff.get('description', '')
        desc = clean_desc(desc_raw)
        eff = get_buff_efficiency(buff_id, buff)
        
        processed_buffs[buff_id] = {
            "id": buff_id,
            "name": buff.get("buffName", ""),
            "icon": buff.get("skillIcon", buff.get("buffIcon", "")),
            "category": buff.get("buffCategory", ""),
            "roomType": buff.get("roomType", ""),
            "desc": desc,
            "efficiency": eff,
            "capacity": get_buff_capacity(desc_raw),
            "moodCost": get_buff_mood_cost(desc_raw),
            "color": buff.get("buffColor", "#333"),
            "textColor": buff.get("textColor", "#fff"),
        }
    
    # === 2. 处理干员数据 ===
    processed_chars = {}
    for char_id, char_building in chars_building.items():
        char_info = char_table.get(char_id, {})
        if not char_info:
            continue
        
        name = char_info.get("name", char_id)
        rarity = char_info.get("rarity", "TIER_1")
        rarity_num = int(rarity.replace("TIER_", "")) if "TIER_" in rarity else 1
        profession = char_info.get("profession", "")
        sub_profession = char_info.get("subProfessionId", "")
        
        skills = []
        for slot_idx, slot in enumerate(char_building.get("buffChar", [])):
            for buff_data in slot.get("buffData", []):
                buff_id = buff_data.get("buffId", "")
                cond = buff_data.get("cond", {})
                elite_req = phase_to_elite(cond.get("phase", "PHASE_0"))
                level_req = cond.get("level", 1)
                
                if buff_id and buff_id in processed_buffs:
                    bi = processed_buffs[buff_id]
                    skills.append({
                        "buffId": buff_id,
                        "name": bi["name"],
                        "icon": bi["icon"],
                        "desc": bi["desc"],
                        "roomType": bi["roomType"],
                        "category": bi["category"],
                        "efficiency": bi["efficiency"],
                        "capacity": bi["capacity"],
                        "moodCost": bi["moodCost"],
                        "eliteReq": elite_req,
                        "levelReq": level_req,
                        "slotIdx": slot_idx,
                        "color": bi["color"],
                        "textColor": bi["textColor"],
                    })
        
        if skills:
            processed_chars[char_id] = {
                "id": char_id,
                "name": name,
                "rarity": rarity_num,
                "profession": profession,
                "subProfession": sub_profession,
                "skills": skills,
            }
    
    # === 3. 验证关键干员 ===
    print("\n=== 验证关键干员技能 ===")
    key_chars = {
        "德克萨斯": None,
        "能天使": None,
        "泡泡": None,
        "雷蛇": None,
        "闪灵": None,
        "杜林": None,
    }
    for cid, char in processed_chars.items():
        if char['name'] in key_chars:
            key_chars[char['name']] = char
    
    for name, char in key_chars.items():
        if char:
            for sk in char['skills']:
                print(f"  {name}: [{sk['roomType']}] {sk['name']} eff={sk['efficiency']} eliteReq={sk['eliteReq']}")
        else:
            print(f"  {name}: 未找到")
    
    # === 4. 输出 data.js ===
    output = f"""// 明日方舟基建模拟器数据文件
// 自动从官方游戏数据提取，共 {len(processed_chars)} 名干员，{len(processed_buffs)} 个基建技能
// 数据来源: Kengxxiao/ArknightsGameData (zh_CN)

const BUILDING_DATA = {{
  buffs: {json.dumps(processed_buffs, ensure_ascii=False, separators=(',',':'))},
  chars: {json.dumps(processed_chars, ensure_ascii=False, separators=(',',':'))},
}};

const PROFESSION_MAP = {{
  "MEDIC": "医疗", "WARRIOR": "近卫", "SNIPER": "狙击",
  "TANK": "重装", "SUPPORT": "辅助", "CASTER": "术师",
  "SPECIAL": "特种", "PIONEER": "先锋",
}};

const ROOM_TYPE_MAP = {{
  "MANUFACTURE": {{ name: "制造站", icon: "⚙️", color: "#3a7bd5" }},
  "TRADING":     {{ name: "贸易站", icon: "📦", color: "#f5a623" }},
  "POWER":       {{ name: "发电站", icon: "⚡", color: "#f0e040" }},
  "DORMITORY":   {{ name: "宿舍",   icon: "🏠", color: "#4caf50" }},
  "CONTROL":     {{ name: "控制中枢", icon: "🎛️", color: "#9c27b0" }},
  "HIRE":        {{ name: "办公室", icon: "📋", color: "#00bcd4" }},
  "TRAINING":    {{ name: "训练室", icon: "🏋️", color: "#ff5722" }},
  "MEETING":     {{ name: "会客室", icon: "☕", color: "#795548" }},
  "WORKSHOP":    {{ name: "加工站", icon: "🔨", color: "#607d8b" }},
}};
"""
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(output)
    
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\nDone: {OUTPUT_PATH} ({size_kb:.0f} KB)")

if __name__ == "__main__":
    main()

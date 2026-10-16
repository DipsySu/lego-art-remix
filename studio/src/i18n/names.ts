import { COLOR_BY_HEX, setById } from "../data/catalog";
import type { PieceId } from "../lib/pieces";
import type { Locale } from "./locale";
import type { MessageKey } from "./messages";

export const PIECE_KEY: Record<PieceId, MessageKey> = {
  "round-tile": "pieceRoundTile",
  "round-plate": "pieceRoundPlate",
  "square-tile": "pieceSquareTile",
  "square-plate": "pieceSquarePlate",
  brick: "pieceBrick",
};

const COLOR_ZH: Record<string, string> = {
  Aqua: "水蓝",
  Black: "黑色",
  Blue: "蓝色",
  "Blue-Violet": "蓝紫",
  "Bright Green": "亮绿",
  "Bright Light Blue": "亮浅蓝",
  "Bright Light Orange": "亮浅橙",
  "Bright Light Yellow": "亮浅黄",
  "Bright Pink": "亮粉",
  Brown: "棕色",
  "Clikits Lavender": "可丽薰衣草",
  Coral: "珊瑚",
  "Dark Azure": "深天蓝",
  "Dark Blue": "深蓝",
  "Dark Blue-Violet": "深蓝紫",
  "Dark Bluish Gray": "深蓝灰",
  "Dark Brown": "深棕",
  "Dark Gray": "深灰",
  "Dark Green": "深绿",
  "Dark Nougat": "深肤色",
  "Dark Orange": "深橙",
  "Dark Pink": "深粉",
  "Dark Purple": "深紫",
  "Dark Red": "深红",
  "Dark Tan": "深米色",
  "Dark Turquoise": "深青绿",
  "Dark Yellow": "深黄",
  "Earth Orange": "大地橙",
  "Fabuland Brown": "童话城棕",
  "Fabuland Orange": "童话城橙",
  "Flat Silver": "哑光银",
  Green: "绿色",
  Lavender: "薰衣草",
  "Light Aqua": "浅水蓝",
  "Light Blue": "浅蓝",
  "Light Bluish Gray": "浅蓝灰",
  "Light Gray": "浅灰",
  "Light Green": "浅绿",
  "Light Lime": "浅青柠",
  "Light Nougat": "浅肤色",
  "Light Orange": "浅橙",
  "Light Pink": "浅粉",
  "Light Purple": "浅紫",
  "Light Salmon": "浅鲑鱼色",
  "Light Turquoise": "浅青绿",
  "Light Violet": "浅紫罗兰",
  "Light Yellow": "浅黄",
  Lime: "青柠",
  "Maersk Blue": "马士基蓝",
  Magenta: "品红",
  "Medium Azure": "中天蓝",
  "Medium Blue": "中蓝",
  "Medium Brown": "中棕",
  "Medium Dark Pink": "中深粉",
  "Medium Green": "中绿",
  "Medium Lavender": "中薰衣草",
  "Medium Lime": "中青柠",
  "Medium Nougat": "中肤色",
  "Medium Orange": "中橙",
  "Medium Violet": "中紫罗兰",
  "Neon Green": "霓虹绿",
  "Neon Orange": "霓虹橙",
  Nougat: "肤色",
  "Olive Green": "橄榄绿",
  Orange: "橙色",
  "Pearl Dark Gray": "珍珠深灰",
  "Pearl Gold": "珍珠金",
  Pink: "粉色",
  Purple: "紫色",
  Red: "红色",
  "Reddish Brown": "红棕",
  Rust: "锈红",
  Salmon: "鲑鱼色",
  "Sand Blue": "沙蓝",
  "Sand Green": "沙绿",
  "Sand Purple": "沙紫",
  "Sand Red": "沙红",
  "Sky Blue": "天蓝",
  Tan: "米色",
  "Very Light Bluish Gray": "极浅蓝灰",
  "Very Light Gray": "极浅灰",
  "Very Light Orange": "极浅橙",
  Violet: "紫罗兰",
  White: "白色",
  Yellow: "黄色",
  "Yellowish Green": "黄绿",
};

const SET_ZH: Record<string, { name: string; description: string }> = {
  art_project: {
    name: "艺术项目 (21226)",
    description: "只用《一起创作》艺术项目（套装 21226）里的零件",
  },
  warhol_marilyn_monroe: {
    name: "沃霍尔 (31197)",
    description: "只用安迪·沃霍尔玛丽莲·梦露（套装 31197）里的零件",
  },
  the_beatles: {
    name: "披头士 (31198)",
    description: "只用披头士（套装 31198）里的零件",
  },
  iron_man: {
    name: "钢铁侠 (31199)",
    description: "只用漫威影业钢铁侠（套装 31199）里的零件",
  },
  star_wars_sith: {
    name: "星球大战 (31200)",
    description: "只用星球大战西斯（套装 31200）里的零件",
  },
  harry_potter_hogwarts_crests: {
    name: "哈利·波特 (31201)",
    description: "只用哈利·波特霍格沃茨徽章（套装 31201）里的零件",
  },
  mickey_mouse: {
    name: "米奇 (31202)",
    description: "只用迪士尼米奇（套装 31202）里的零件",
  },
  world_map: {
    name: "世界地图 (31203)",
    description: "只用世界地图（套装 31203）里的零件",
  },
  elvis: {
    name: "猫王 (31204)",
    description: "只用猫王埃尔维斯（套装 31204）里的零件",
  },
  batman: {
    name: "蝙蝠侠 (31205)",
    description: "只用吉姆·李蝙蝠侠收藏（套装 31205）里的零件",
  },
  personalized_portrait_4502: {
    name: "定制肖像 (40179)",
    description: "只用定制马赛克肖像（套装 40179）里的零件",
  },
  all_stud_colors: {
    name: "全部圆板颜色",
    description: "1×1 圆板有售的全部颜色",
  },
  all_tile_colors: {
    name: "全部圆片颜色",
    description: "1×1 圆片有售的全部颜色",
  },
  all_solid_colors: {
    name: "全部支持的颜色",
    description: "这个工具支持的全部颜色",
  },
  pick_a_brick: {
    name: "Pick a Brick 圆板颜色",
    description: "乐高官网 Pick a Brick 页面上有售的圆板颜色",
  },
};

export function colorLabel(hex: string, locale: Locale): string {
  const color = COLOR_BY_HEX.get(hex.toLowerCase());
  if (!color) return hex.toUpperCase();
  if (locale === "zh") return COLOR_ZH[color.name] ?? color.name;
  return color.name;
}

export function colorSearchText(name: string): string {
  return `${name} ${COLOR_ZH[name] ?? ""}`.toLowerCase();
}

export function setLabel(id: string, locale: Locale): { name: string; description: string } {
  const set = setById(id);
  if (locale === "zh" && SET_ZH[id]) return SET_ZH[id];
  return { name: set.name, description: set.description };
}

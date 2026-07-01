// Item categories: 가전(appliance) / 가구(furniture). Null/unknown → 기타.
// Colors are grounded in the subject: appliances read as cool steel, furniture as warm wood.

export const CATEGORY_ORDER = ['appliance', 'furniture', 'uncategorized'];

export const CATEGORY_META = {
  appliance: { label: '가전', color: '#35625c' },
  furniture: { label: '가구', color: '#8a4b42' },
  uncategorized: { label: '기타', color: '#8a6d3b' },
};

export function catKey(category) {
  return category === 'appliance' || category === 'furniture' ? category : 'uncategorized';
}

export function catLabel(category) {
  return CATEGORY_META[catKey(category)].label;
}

export function catColor(category) {
  return CATEGORY_META[catKey(category)].color;
}

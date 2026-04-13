/**
 * يحوّل fieldsJson القادم من الباكند إلى قائمة حقول للواجهة.
 * يدعم أشكالاً شائعة؛ إذا الشكل مختلف، رجّع [] ويُستخدم النموذج الثابت في contractGenerator.
 *
 * أمثلة مقبولة:
 * - [{ "name": "employeeName", "label": "اسم الموظف", "required": true }]
 * - [{ "key": "salary", "labelAr": "الراتب" }]
 * - { "fields": [ ... ] }
 * - JSON Schema مبسّط: { "properties": { "x": { "title": "..." } } }
 */

/**
 * @param {unknown} raw
 * @returns {{ key: string; label: string; inputType: 'text' | 'number' | 'textarea'; required: boolean }[]}
 */
export function parseContractFieldsJson(raw) {
  if (raw == null || raw === '') return [];

  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (parsed == null) return [];

  /** @type {any[]} */
  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (Array.isArray(parsed.fields)) {
    list = parsed.fields;
  } else if (parsed.properties && typeof parsed.properties === 'object') {
    list = Object.entries(parsed.properties).map(([name, v]) => ({
      name,
      ...(typeof v === 'object' && v ? v : {}),
    }));
  } else {
    return [];
  }

  return list
    .map((f, i) => {
      if (!f || typeof f !== 'object') return null;
      const key = f.name ?? f.key ?? f.id ?? f.field ?? `field_${i}`;
      const label =
        f.label ??
        f.labelAr ??
        f.title ??
        f.nameAr ??
        f.displayName ??
        String(key);
      let inputType = 'text';
      const t = (f.type || f.inputType || '').toString().toLowerCase();
      if (t === 'number' || t === 'integer' || t === 'decimal') inputType = 'number';
      if (t === 'textarea' || t === 'multiline') inputType = 'textarea';
      return {
        key: String(key),
        label: String(label),
        inputType,
        required: Boolean(f.required),
      };
    })
    .filter(Boolean);
}

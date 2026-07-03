import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { won } from '../format.js';
import { catKey, catColor, catSoft, catLabel } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { CarryInBadge } from '../CarryInBadge.jsx';
import { CeilingBadge } from '../CeilingBadge.jsx';
import { Tabs } from '../Tabs.jsx';

const TARGET_KEY = 'honsu_budget_target';
const DEFAULT_TARGET = 15000000;

function loadTarget() {
  const v = Number(globalThis.localStorage?.getItem(TARGET_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TARGET;
}

function dimLabel(it) {
  const { confirmed_width_cm: w, confirmed_depth_cm: d, confirmed_height_cm: h } = it;
  if (!w && !d && !h) return '';
  return [w, d, h].filter((n) => n != null).join(' × ');
}

function IconSquare({ category, size = 20, big = false }) {
  const key = catKey(category);
  return (
    <span
      className={big ? 'ico-sq ico-sq-lg' : 'ico-sq'}
      style={{ background: catSoft(key), color: catColor(key) }}
    >
      <CategoryIcon category={key} size={size} />
    </span>
  );
}

export function HomePage() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('appliance');
  const [target, setTarget] = useState(loadTarget);
  const [editingTarget, setEditingTarget] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [s, list, hs] = await Promise.all([api.getSummary(), api.listItems(), api.getHomeSettings()]);
      setSummary(s);
      setItems(list);
      setSettings(hs);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function addItem(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createItem(name.trim(), category);
      setName('');
      await load();
    } catch (e) { setError(e.message); }
  }

  function saveTarget(v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      setTarget(n);
      globalThis.localStorage?.setItem(TARGET_KEY, String(n));
    }
    setEditingTarget(false);
  }

  const confirmed = items.filter((it) => it.confirmed_candidate_id);
  const comparing = items.filter((it) => !it.confirmed_candidate_id);
  const confirmedTotal = summary?.confirmed_total ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((confirmedTotal / target) * 100)) : 0;
  const remaining = Math.max(0, target - confirmedTotal);
  const over = Math.max(0, confirmedTotal - target);
  const overBudget = confirmedTotal > target;

  return (
    <main className="container home">
      <Tabs />

      {error && <p className="error">{error}</p>}

      {summary && (
        <section className="budget-card">
          <div className="budget-top">
            <div>
              <div className="budget-label">확정 합계</div>
              <div className="budget-total num">{won(confirmedTotal)}</div>
            </div>
            <div className="budget-pills">
              <span className="pill pill-rose">확정 {confirmed.length}</span>
              <span className="pill pill-gray">비교중 {comparing.length}</span>
            </div>
          </div>
          <div className="progress">
            <div className={`progress-fill${overBudget ? ' over' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="budget-foot">
            {overBudget ? (
              <span className="budget-over">한도 초과 <span className="num">+{won(over)}</span></span>
            ) : (
              <span className="budget-remain">남은 예산 <span className="num">{won(remaining)}</span></span>
            )}
            {editingTarget ? (
              <input
                className="target-input num"
                type="number"
                defaultValue={target}
                aria-label="예산 한도"
                autoFocus
                onBlur={(e) => saveTarget(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(e.target.value); }}
              />
            ) : (
              <button type="button" className="target-btn" onClick={() => setEditingTarget(true)}>
                한도 <span className="num">{won(target)}</span>
              </button>
            )}
          </div>
        </section>
      )}

      <form onSubmit={addItem} className="add-row">
        <input
          aria-label="새 항목 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 항목 추가 · 예: 공기청정기"
        />
        <select aria-label="분류" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="appliance">가전</option>
          <option value="furniture">가구</option>
        </select>
        <button type="submit">＋ 추가</button>
      </form>

      {items.length === 0 && (
        <p className="empty">아직 항목이 없어요. 필요한 가전·가구를 하나씩 적어보세요.</p>
      )}

      {comparing.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">정하는 중</h2>
            <span className="count-chip count-rose">{comparing.length}</span>
            <span className="section-hint">후보를 비교하고 확정하세요</span>
          </div>
          <div className="compare-list">
            {comparing.map((it) => (
              <Link key={it.id} to={`/items/${it.id}`} className="compare-card">
                <IconSquare category={it.category} />
                <div className="compare-main">
                  <div className="compare-name">{it.name}</div>
                  <div className="compare-spec">{catLabel(it.category)}</div>
                </div>
                <span className="status-chip">
                  {it.candidate_count > 0 ? `후보 ${it.candidate_count}개` : '비교중'}
                </span>
                <span className="compare-go">비교 →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {confirmed.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">확정 완료</h2>
            <span className="count-chip count-gray">{confirmed.length}</span>
            <span className="section-total num">합계 {won(confirmedTotal)}</span>
          </div>
          <div className="confirmed-list">
            {confirmed.map((it) => (
              <Link key={it.id} to={`/items/${it.id}`} className="confirmed-row">
                <IconSquare category={it.category} size={17} />
                <div className="confirmed-main">
                  <div className="confirmed-name">{it.name}</div>
                  {it.confirmed_name && <div className="confirmed-store">{it.confirmed_name}</div>}
                </div>
                {dimLabel(it) && <span className="dim-chip num">{dimLabel(it)}</span>}
                <CarryInBadge
                  dims={{ width_cm: it.confirmed_width_cm, depth_cm: it.confirmed_depth_cm, height_cm: it.confirmed_height_cm }}
                  settings={settings}
                  hideUnknown
                />
                <CeilingBadge heightCm={it.confirmed_height_cm} settings={settings} />
                <div className="confirmed-price num">{won(it.confirmed_price)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

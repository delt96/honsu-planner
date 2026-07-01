import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { won } from '../format.js';
import { CATEGORY_ORDER, CATEGORY_META, catKey } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';

export function HomePage() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('appliance');
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [s, list] = await Promise.all([api.getSummary(), api.listItems()]);
      setSummary(s);
      setItems(list);
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

  const groups = CATEGORY_ORDER
    .map((key) => ({ key, items: items.filter((it) => catKey(it.category) === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="container">
      <header className="page-head">
        <p className="eyebrow">우리의 혼수</p>
        <h1 className="display">혼수 목록</h1>
        <p className="nav"><Link to="/layout">평면도 배치 →</Link></p>
      </header>

      {summary && (
        <div className="summary" role="status">
          <span className="summary-label">확정 합계</span>
          <strong>{won(summary.confirmed_total)}</strong>
          <span className="summary-sub">아직 정하지 않은 항목 {summary.unconfirmed_count}건</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <form onSubmit={addItem} className="add-row">
        <input
          aria-label="새 항목 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 냉장고"
        />
        <select aria-label="분류" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="appliance">가전</option>
          <option value="furniture">가구</option>
        </select>
        <button type="submit">＋ 항목 추가</button>
      </form>

      {items.length === 0 && (
        <p className="empty">아직 항목이 없어요. 필요한 가전·가구를 하나씩 적어보세요.</p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="item-group">
          <div className="group-head" style={{ color: CATEGORY_META[g.key].color }}>
            <CategoryIcon category={g.key} size={18} />
            <h2 className="group-title">{CATEGORY_META[g.key].label}</h2>
            <span className="group-count">{g.items.length}</span>
          </div>
          <ul className="item-list">
            {g.items.map((it) => (
              <li key={it.id}>
                <Link to={`/items/${it.id}`}>
                  <span className="item-main">
                    <span className="cat-mark" style={{ color: CATEGORY_META[catKey(it.category)].color }}>
                      <CategoryIcon category={catKey(it.category)} size={16} />
                    </span>
                    <span className="item-name">{it.name}</span>
                  </span>
                  {it.confirmed_candidate_id ? (
                    <span className="badge confirmed">✅ {won(it.confirmed_price)}</span>
                  ) : (
                    <span className="badge">⚪ 비교중</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { won } from '../format.js';
import { catKey, catColor } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';

const EMPTY = { name: '', price: '', url: '', memo: '', width_cm: '', depth_cm: '', height_cm: '' };

export function ItemDetailPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  async function load() {
    try { setItem(await api.getItem(itemId)); } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, [itemId]);

  async function addCandidate(e) {
    e.preventDefault();
    try { await api.addCandidate(itemId, form); setForm(EMPTY); await load(); }
    catch (e) { setError(e.message); }
  }
  async function confirm(cid) {
    try { await api.confirm(itemId, cid); await load(); } catch (e) { setError(e.message); }
  }
  async function unconfirm() {
    try { await api.unconfirm(itemId); await load(); } catch (e) { setError(e.message); }
  }
  async function removeCandidate(cid) {
    try { await api.deleteCandidate(cid); await load(); } catch (e) { setError(e.message); }
  }
  async function changeCategory(e) {
    const value = e.target.value;
    try { await api.updateItem(itemId, { category: value }); await load(); }
    catch (e) { setError(e.message); }
  }

  if (!item) {
    return (
      <main className="container">
        <Link to="/">← 목록</Link>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="container">
      <Link to="/">← 목록</Link>
      <div className="detail-head">
        <h1 className="display">{item.name}</h1>
        <label className="cat-select">
          <span className="cat-mark" style={{ color: catColor(item.category) }}>
            <CategoryIcon category={catKey(item.category)} size={16} />
          </span>
          <select aria-label="분류 변경" value={item.category ?? ''} onChange={changeCategory}>
            <option value="">미분류</option>
            <option value="appliance">가전</option>
            <option value="furniture">가구</option>
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="candidate-list">
        {item.candidates.map((c) => {
          const isConfirmed = c.id === item.confirmed_candidate_id;
          return (
            <li key={c.id} className={isConfirmed ? 'confirmed' : ''}>
              <div className="cand-head">
                <span className="cand-name">{isConfirmed && '⭐ '}{c.name}</span>
                <span className="cand-price">{won(c.price)}</span>
              </div>
              {c.url && <a href={c.url} target="_blank" rel="noreferrer">링크</a>}
              {c.memo && <p className="memo">{c.memo}</p>}
              {(c.width_cm || c.depth_cm || c.height_cm) && (
                <p className="dims">
                  {c.width_cm ?? '—'} × {c.depth_cm ?? '—'} × {c.height_cm ?? '—'} cm
                </p>
              )}
              <div className="cand-actions">
                {isConfirmed ? (
                  <button onClick={unconfirm}>확정 해제</button>
                ) : (
                  <button onClick={() => confirm(c.id)}>이걸로 확정</button>
                )}
                <button onClick={() => removeCandidate(c.id)} className="danger">삭제</button>
              </div>
            </li>
          );
        })}
      </ul>
      <form onSubmit={addCandidate} className="cand-form">
        <h2>후보 추가</h2>
        <input aria-label="후보 이름" placeholder="이름" value={form.name} onChange={set('name')} />
        <input aria-label="가격" placeholder="가격(원)" value={form.price} onChange={set('price')} />
        <input aria-label="URL" placeholder="URL" value={form.url} onChange={set('url')} />
        <input aria-label="메모" placeholder="메모" value={form.memo} onChange={set('memo')} />
        <input aria-label="가로" placeholder="가로(cm)" value={form.width_cm} onChange={set('width_cm')} />
        <input aria-label="세로" placeholder="세로(cm)" value={form.depth_cm} onChange={set('depth_cm')} />
        <input aria-label="높이" placeholder="높이(cm)" value={form.height_cm} onChange={set('height_cm')} />
        <button type="submit">추가</button>
      </form>
    </main>
  );
}

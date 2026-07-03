import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { won, commas, digitsOnly } from '../format.js';
import { catKey, catColor, catSoft, catLabel } from '../categories.js';
import { CategoryIcon } from '../icons.jsx';
import { CarryInBadge } from '../CarryInBadge.jsx';
import { CeilingBadge } from '../CeilingBadge.jsx';

const EMPTY = { name: '', brand: '', price: '', url: '', memo: '', width_cm: '', depth_cm: '', height_cm: '' };

function editValues(c) {
  return {
    name: c.name ?? '', brand: c.brand ?? '', price: c.price ?? '', url: c.url ?? '', memo: c.memo ?? '',
    width_cm: c.width_cm ?? '', depth_cm: c.depth_cm ?? '', height_cm: c.height_cm ?? '',
  };
}

export function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const itemId = Number(id);
  const [item, setItem] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  async function load() {
    try { setItem(await api.getItem(itemId)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [itemId]);
  useEffect(() => { Promise.resolve(api.getHomeSettings()).then(setSettings).catch(() => {}); }, []);

  function startEdit(c) { setEditId(c.id); setEditForm(editValues(c)); }
  function cancelEdit() { setEditId(null); setEditForm(EMPTY); }
  async function saveEdit(e) {
    e.preventDefault();
    try { await api.updateCandidate(editId, editForm); cancelEdit(); await load(); }
    catch (e) { setError(e.message); }
  }

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
  async function removeItem() {
    if (!globalThis.confirm(`'${item.name}' 항목을 삭제할까요?\n후보와 배치 정보도 함께 삭제됩니다.`)) return;
    try { await api.deleteItem(itemId); navigate('/'); }
    catch (e) { setError(e.message); }
  }

  if (!item) {
    return (
      <main className="container">
        <Link to="/" className="back">← 목록</Link>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setEdit = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });
  const setPrice = (e) => setForm({ ...form, price: digitsOnly(e.target.value) });
  const setEditPrice = (e) => setEditForm({ ...editForm, price: digitsOnly(e.target.value) });
  const key = catKey(item.category);

  const priced = item.candidates.filter((c) => c.price != null);
  const minP = priced.length ? Math.min(...priced.map((c) => c.price)) : null;
  const maxP = priced.length ? Math.max(...priced.map((c) => c.price)) : null;
  const cheapestId = priced.length
    ? priced.reduce((a, b) => (a.price <= b.price ? a : b)).id
    : null;
  const confirmedCand = item.candidates.find((c) => c.id === item.confirmed_candidate_id);
  const posOf = (p) => (maxP > minP ? ((p - minP) / (maxP - minP)) * 100 : 0);

  function dims(c) {
    if (!c.width_cm && !c.depth_cm && !c.height_cm) return null;
    return `${c.width_cm ?? '—'} × ${c.depth_cm ?? '—'} × ${c.height_cm ?? '—'} cm`;
  }

  return (
    <main className="container detail">
      <div className="detail-top">
        <Link to="/" className="back">← 목록</Link>
        <button type="button" className="btn-del-item" onClick={removeItem}>항목 삭제</button>
      </div>

      <header className="detail-head">
        <span className="ico-sq ico-sq-lg" style={{ background: catSoft(key), color: catColor(key) }}>
          <CategoryIcon category={key} size={24} />
        </span>
        <div className="detail-titles">
          <h1 className="detail-name">{item.name}</h1>
          <div className="detail-sub">{catLabel(item.category)} · 후보 {item.candidates.length}</div>
        </div>
        <label className="cat-select">
          <select aria-label="분류 변경" value={item.category ?? ''} onChange={changeCategory}>
            <option value="">미분류</option>
            <option value="appliance">가전</option>
            <option value="furniture">가구</option>
          </select>
        </label>
      </header>

      {error && <p className="error">{error}</p>}

      {priced.length > 0 && (
        <section className="price-range">
          <div className="pr-head">
            <span className="pr-label">후보 가격대</span>
            <span className="pr-minmax">
              최저 <b className="num pr-low">{minP.toLocaleString('ko-KR')}</b> ~ 최고{' '}
              <b className="num">{maxP.toLocaleString('ko-KR')}원</b>
            </span>
          </div>
          <div className="pr-track">
            <span className="pr-dot pr-dot-low" style={{ left: '0%' }} />
            {confirmedCand?.price != null && (
              <span className="pr-dot pr-dot-conf" style={{ left: `${posOf(confirmedCand.price)}%` }} />
            )}
            <span className="pr-dot pr-dot-high" style={{ left: '100%' }} />
          </div>
          <div className="pr-legend">
            <span><span className="dot dot-low" />최저가</span>
            <span><span className="dot dot-conf" />확정</span>
          </div>
        </section>
      )}

      <div className="cand-list">
        {item.candidates.map((c) => {
          const isConfirmed = c.id === item.confirmed_candidate_id;
          const isCheapest = c.id === cheapestId && !isConfirmed;
          const d = dims(c);
          return (
            <div key={c.id} className={`cand-card${isConfirmed ? ' confirmed' : ''}`}>
              {isConfirmed && <span className="conf-pill">✓ 확정된 후보</span>}
              <div className="cand-top">
                <div className="cand-title">
                  {c.brand && <span className="cand-brand">{c.brand}</span>}
                  <span className="cand-name">{c.name}</span>
                  {isCheapest && <span className="cheapest-chip">최저가</span>}
                </div>
                <span className={`cand-price num${isConfirmed ? ' price-conf' : ''}`}>{won(c.price)}</span>
              </div>
              {d && <div className="chip-row"><span className="spec-chip num">{d}</span></div>}
              {isConfirmed && (
                <div className="chip-row">
                  <CarryInBadge dims={c} settings={settings} showReason />
                  <CeilingBadge heightCm={c.height_cm} settings={settings} />
                </div>
              )}
              {c.memo && <p className="cand-memo">{c.memo}</p>}
              <div className="cand-actions">
                {isConfirmed ? (
                  <button className="btn-unconfirm" onClick={unconfirm}>확정 해제</button>
                ) : (
                  <button className="btn-confirm" onClick={() => confirm(c.id)}>이걸로 확정</button>
                )}
                {c.url && (
                  <a className="btn-link" href={c.url} target="_blank" rel="noreferrer">링크 ↗</a>
                )}
                <button className="btn-edit" onClick={() => startEdit(c)}>수정</button>
                <button className="danger" onClick={() => removeCandidate(c.id)}>삭제</button>
              </div>
              {editId === c.id && (
                <form onSubmit={saveEdit} className="cand-edit">
                  <input aria-label="수정 이름" placeholder="이름" value={editForm.name} onChange={setEdit('name')} />
                  <input aria-label="수정 브랜드" placeholder="브랜드" value={editForm.brand} onChange={setEdit('brand')} />
                  <input aria-label="수정 가격" inputMode="numeric" placeholder="가격(원)" value={commas(editForm.price)} onChange={setEditPrice} />
                  <input aria-label="수정 URL" placeholder="URL" value={editForm.url} onChange={setEdit('url')} />
                  <input aria-label="수정 메모" placeholder="메모" value={editForm.memo} onChange={setEdit('memo')} />
                  <input aria-label="수정 가로" placeholder="가로(cm)" value={editForm.width_cm} onChange={setEdit('width_cm')} />
                  <input aria-label="수정 세로" placeholder="세로(cm)" value={editForm.depth_cm} onChange={setEdit('depth_cm')} />
                  <input aria-label="수정 높이" placeholder="높이(cm)" value={editForm.height_cm} onChange={setEdit('height_cm')} />
                  <div className="edit-actions">
                    <button type="submit">저장</button>
                    <button type="button" className="btn-ghost" onClick={cancelEdit}>취소</button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={addCandidate} className="cand-form">
        <h2>후보 추가</h2>
        <input aria-label="후보 이름" placeholder="이름" value={form.name} onChange={set('name')} />
        <input aria-label="브랜드" placeholder="브랜드(예: 삼성)" value={form.brand} onChange={set('brand')} />
        <input aria-label="가격" inputMode="numeric" placeholder="가격(원)" value={commas(form.price)} onChange={setPrice} />
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

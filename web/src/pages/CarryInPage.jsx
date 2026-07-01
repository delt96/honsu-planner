import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Tabs } from '../Tabs.jsx';

const SETTING_FIELDS = [
  'door_width_cm', 'door_height_cm',
  'elevator_door_width_cm', 'elevator_door_height_cm',
  'elevator_car_width_cm', 'elevator_car_depth_cm', 'elevator_car_height_cm',
];
const EMPTY = Object.fromEntries(SETTING_FIELDS.map((k) => [k, '']));
const toForm = (s) => Object.fromEntries(SETTING_FIELDS.map((k) => [k, s?.[k] ?? '']));

export function CarryInPage() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    try { setForm(toForm(await api.getHomeSettings())); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false); };
  async function save(e) {
    e.preventDefault();
    try { setForm(toForm(await api.saveHomeSettings(form))); setSaved(true); }
    catch (e) { setError(e.message); }
  }

  return (
    <main className="container home">
      <Tabs />
      <header className="page-head">
        <p className="eyebrow">우리 집 반입 조건</p>
        <h1 className="display">반입 정보</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <form onSubmit={save} className="carry-form carry-page-form">
        <fieldset className="carry-group">
          <legend>현관문</legend>
          <input aria-label="현관문 폭" placeholder="폭(cm)" value={form.door_width_cm} onChange={set('door_width_cm')} />
          <input aria-label="현관문 높이" placeholder="높이(cm)" value={form.door_height_cm} onChange={set('door_height_cm')} />
        </fieldset>
        <fieldset className="carry-group">
          <legend>엘리베이터 문</legend>
          <input aria-label="엘베문 폭" placeholder="폭(cm)" value={form.elevator_door_width_cm} onChange={set('elevator_door_width_cm')} />
          <input aria-label="엘베문 높이" placeholder="높이(cm)" value={form.elevator_door_height_cm} onChange={set('elevator_door_height_cm')} />
        </fieldset>
        <fieldset className="carry-group">
          <legend>엘리베이터 내부</legend>
          <input aria-label="엘베 내부 폭" placeholder="폭(cm)" value={form.elevator_car_width_cm} onChange={set('elevator_car_width_cm')} />
          <input aria-label="엘베 내부 깊이" placeholder="깊이(cm)" value={form.elevator_car_depth_cm} onChange={set('elevator_car_depth_cm')} />
          <input aria-label="엘베 내부 높이" placeholder="높이(cm)" value={form.elevator_car_height_cm} onChange={set('elevator_car_height_cm')} />
        </fieldset>
        <div className="carry-actions">
          <button type="submit">저장</button>
          {saved && <span className="carry-saved">저장됨 ✓</span>}
        </div>
      </form>

      <p className="carry-hint">
        입력한 현관·엘리베이터 치수를 확정 가구의 치수와 비교해, 목록·품목 화면에서 반입 가능/불가를 알려드려요.
        비워 둔 항목은 판정에서 제외됩니다.
      </p>
    </main>
  );
}

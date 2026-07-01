import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';
import { ItemDetailPage } from './ItemDetailPage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getItem: vi.fn(), addCandidate: vi.fn(), confirm: vi.fn(),
    unconfirm: vi.fn(), deleteCandidate: vi.fn(),
  },
}));

function renderAt(id) {
  return render(
    <MemoryRouter initialEntries={[`/items/${id}`]}>
      <Routes><Route path="/items/:id" element={<ItemDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

test('shows candidates and confirm action', async () => {
  api.getItem.mockResolvedValue({
    id: 1, name: '냉장고', confirmed_candidate_id: null,
    candidates: [{ id: 5, name: 'LG', price: 1200000, url: null, memo: null,
      width_cm: 91, depth_cm: 70, height_cm: 179 }],
  });
  renderAt(1);
  expect(await screen.findByText('LG')).toBeInTheDocument();
  expect(screen.getByText('1,200,000원')).toBeInTheDocument();
  expect(screen.getByText('이걸로 확정')).toBeInTheDocument();
});

test('confirm calls api and reloads', async () => {
  api.getItem.mockResolvedValue({
    id: 1, name: '냉장고', confirmed_candidate_id: null,
    candidates: [{ id: 5, name: 'LG', price: 1200000, url: null, memo: null,
      width_cm: null, depth_cm: null, height_cm: null }],
  });
  api.confirm.mockResolvedValue({});
  renderAt(1);
  await screen.findByText('LG');
  await userEvent.click(screen.getByText('이걸로 확정'));
  await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(1, 5));
});

test('adds a candidate', async () => {
  api.getItem.mockResolvedValue({ id: 1, name: '냉장고', confirmed_candidate_id: null, candidates: [] });
  api.addCandidate.mockResolvedValue({});
  renderAt(1);
  await screen.findByText('후보 추가');
  await userEvent.type(screen.getByLabelText('후보 이름'), '삼성');
  await userEvent.type(screen.getByLabelText('가격'), '1000000');
  await userEvent.click(screen.getByText('추가'));
  await waitFor(() =>
    expect(api.addCandidate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: '삼성', price: '1000000' })
    )
  );
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';
import { HomePage } from './HomePage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: { getSummary: vi.fn(), listItems: vi.fn(), createItem: vi.fn(), getHomeSettings: vi.fn() },
}));

beforeEach(() => { vi.clearAllMocks(); });

test('renders budget summary and splits confirmed vs comparing', async () => {
  api.getSummary.mockResolvedValue({ confirmed_total: 1200000, unconfirmed_count: 1 });
  api.listItems.mockResolvedValue([
    { id: 1, name: '냉장고', category: 'appliance', confirmed_candidate_id: 9, confirmed_name: '삼성', confirmed_price: 1200000, candidate_count: 2 },
    { id: 2, name: '소파', category: 'furniture', confirmed_candidate_id: null, confirmed_price: null, candidate_count: 3 },
  ]);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText('냉장고')).toBeInTheDocument(); // confirmed list
  expect(screen.getByText('소파')).toBeInTheDocument(); // comparing list
  expect(screen.getByText('확정 1')).toBeInTheDocument();
  expect(screen.getByText('비교중 1')).toBeInTheDocument();
  expect(screen.getByText('후보 3개')).toBeInTheDocument(); // 소파 candidate count
});

test('adds an item and reloads', async () => {
  api.getSummary.mockResolvedValue({ confirmed_total: 0, unconfirmed_count: 0 });
  api.listItems.mockResolvedValue([]);
  api.createItem.mockResolvedValue({ id: 1, name: '소파' });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('새 항목 이름'), '소파');
  await userEvent.selectOptions(screen.getByLabelText('분류'), 'furniture');
  await userEvent.click(screen.getByText('＋ 추가'));
  await waitFor(() => expect(api.createItem).toHaveBeenCalledWith('소파', 'furniture'));
});

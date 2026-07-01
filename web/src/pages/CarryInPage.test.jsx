import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';
import { CarryInPage } from './CarryInPage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: { getHomeSettings: vi.fn(), saveHomeSettings: vi.fn() },
}));

beforeEach(() => { vi.clearAllMocks(); });

test('loads existing settings into the form', async () => {
  api.getHomeSettings.mockResolvedValue({ id: 1, door_width_cm: 90, door_height_cm: 210 });
  render(<MemoryRouter><CarryInPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByLabelText('현관문 폭')).toHaveValue('90'));
  expect(screen.getByLabelText('현관문 높이')).toHaveValue('210');
});

test('saves entered dimensions and shows a confirmation', async () => {
  api.getHomeSettings.mockResolvedValue({ id: 1 });
  api.saveHomeSettings.mockResolvedValue({ id: 1, door_width_cm: 85 });
  render(<MemoryRouter><CarryInPage /></MemoryRouter>);
  await screen.findByLabelText('현관문 폭');
  await userEvent.type(screen.getByLabelText('현관문 폭'), '85');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(api.saveHomeSettings).toHaveBeenCalledWith(expect.objectContaining({ door_width_cm: '85' }))
  );
  expect(await screen.findByText('저장됨 ✓')).toBeInTheDocument();
});

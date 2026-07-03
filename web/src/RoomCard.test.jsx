import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, test, expect, beforeEach } from 'vitest';
import { RoomCard } from './RoomCard.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: { createFeature: vi.fn(), updateFeature: vi.fn(), deleteFeature: vi.fn(), updateRoom: vi.fn() },
}));

beforeEach(() => { vi.clearAllMocks(); });

const ROOM = {
  id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 300, ceiling_height_cm: null,
  features: [
    { id: 11, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, sill_height_cm: null, floor_height_cm: null, swing: 'in-left' },
  ],
};

test('lists existing features with a one-line summary', () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText('남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌')).toBeInTheDocument();
});

test('＋문 opens a door form and submits kind + fields', async () => {
  api.createFeature.mockResolvedValue({});
  const onChanged = vi.fn();
  render(<RoomCard room={ROOM} onChanged={onChanged} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '＋ 문' }));
  await userEvent.selectOptions(screen.getByLabelText('벽'), 'S');
  await userEvent.type(screen.getByLabelText('모서리에서'), '30');
  await userEvent.type(screen.getByLabelText('폭'), '80');
  await userEvent.selectOptions(screen.getByLabelText('열림'), 'in-left');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(api.createFeature).toHaveBeenCalledWith(1,
    expect.objectContaining({ kind: 'door', wall: 'S', offset_cm: '30', width_cm: '80', swing: 'in-left' })));
  expect(onChanged).toHaveBeenCalled();
});

test('콘센트 form has no width field but has a floor-height field', async () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '＋ 콘센트' }));
  expect(screen.queryByLabelText('폭')).not.toBeInTheDocument();
  expect(screen.getByLabelText('바닥에서')).toBeInTheDocument();
});

test('ceiling blur saves via updateRoom', async () => {
  api.updateRoom.mockResolvedValue({});
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  const inp = screen.getByLabelText('거실 천장 높이');
  await userEvent.type(inp, '235');
  fireEvent.blur(inp);
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { ceiling_height_cm: '235' }));
});

test('수정 opens a pre-filled form and PATCHes', async () => {
  api.updateFeature.mockResolvedValue({});
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '수정' }));
  const off = screen.getByLabelText('모서리에서');
  expect(off).toHaveValue('30');
  await userEvent.clear(off);
  await userEvent.type(off, '40');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(11, expect.objectContaining({ offset_cm: '40' })));
});

test('삭제 calls deleteFeature', async () => {
  api.deleteFeature.mockResolvedValue(null);
  const onChanged = vi.fn();
  render(<RoomCard room={ROOM} onChanged={onChanged} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '부착물 삭제 11' }));
  await waitFor(() => expect(api.deleteFeature).toHaveBeenCalledWith(11));
});

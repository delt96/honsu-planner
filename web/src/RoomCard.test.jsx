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

test('ceiling blur saves via updateRoom', async () => {
  api.updateRoom.mockResolvedValue({});
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  const inp = screen.getByLabelText('거실 천장 높이');
  await userEvent.type(inp, '235');
  fireEvent.blur(inp);
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { ceiling_height_cm: '235' }));
});

test('삭제 calls deleteFeature', async () => {
  api.deleteFeature.mockResolvedValue(null);
  const onChanged = vi.fn();
  render(<RoomCard room={ROOM} onChanged={onChanged} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '부착물 삭제 11' }));
  await waitFor(() => expect(api.deleteFeature).toHaveBeenCalledWith(11));
});

test('부착물 행 클릭은 onSelect로 도면 선택을 위임한다', async () => {
  const onSelect = vi.fn();
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />);
  await userEvent.click(screen.getByText('남쪽 · 모서리 30cm · 폭80 · 높이204 · 안·좌'));
  expect(onSelect).toHaveBeenCalledWith(11);
});

test('추가/수정 폼은 더 이상 없다', () => {
  render(<RoomCard room={ROOM} onChanged={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '＋ 문' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
});

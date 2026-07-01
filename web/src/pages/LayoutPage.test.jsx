import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect, beforeEach } from 'vitest';
import { LayoutPage } from './LayoutPage.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getLayout: vi.fn(), createRoom: vi.fn(), deleteRoom: vi.fn(),
    placeItem: vi.fn(), unplaceItem: vi.fn(), updateRoom: vi.fn(),
  },
}));

const LAYOUT = {
  rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500 }],
  placements: [{ item_id: 5, name: '소파', x: 10, y: 20, rotation: 0, width_cm: 200, depth_cm: 90 }],
  palette: [{ item_id: 7, name: '식탁', width_cm: 120, depth_cm: 80 }],
  unplaceable: [{ item_id: 9, name: '스탠드' }],
};

beforeEach(() => { vi.clearAllMocks(); });

test('renders rooms, placed furniture, palette, and unplaceable', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  expect(await screen.findByText('소파')).toBeInTheDocument();
  expect(within(screen.getByTestId('room-list')).getByText(/거실/)).toBeInTheDocument();
  expect(screen.getByText(/식탁/)).toBeInTheDocument();
  expect(screen.getByText(/스탠드/)).toBeInTheDocument();
});

test('add room calls api.createRoom', async () => {
  api.getLayout.mockResolvedValue({ rooms: [], placements: [], palette: [], unplaceable: [] });
  api.createRoom.mockResolvedValue({ id: 1 });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText('방 추가');
  await userEvent.type(screen.getByLabelText('방 이름'), '침실');
  await userEvent.type(screen.getByLabelText('방 가로'), '300');
  await userEvent.type(screen.getByLabelText('방 세로'), '400');
  await userEvent.click(screen.getByRole('button', { name: '방 추가' }));
  await waitFor(() => expect(api.createRoom).toHaveBeenCalledWith({ name: '침실', width_cm: '300', depth_cm: '400' }));
});

test('placing a palette item calls api.placeItem', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.placeItem.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText(/식탁/);
  await userEvent.click(screen.getByRole('button', { name: '배치' }));
  await waitFor(() => expect(api.placeItem).toHaveBeenCalledWith(7, { x: 10, y: 10, rotation: 0 }));
});

test('rotate calls api.placeItem with next rotation', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.placeItem.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText('소파');
  await userEvent.click(screen.getByRole('button', { name: '회전' }));
  await waitFor(() => expect(api.placeItem).toHaveBeenCalledWith(5, { x: 10, y: 20, rotation: 90 }));
});

test('remove calls api.unplaceItem', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.unplaceItem.mockResolvedValue(null);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText('소파');
  await userEvent.click(screen.getByRole('button', { name: '제거' }));
  await waitFor(() => expect(api.unplaceItem).toHaveBeenCalledWith(5));
});

test('dragging a room persists the snapped new position', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.updateRoom.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  const rect = await screen.findByTestId('room-1');
  const svg = screen.getByRole('img', { name: '평면도' });
  // move +40px in x → 40 / 0.4 = 100cm; room.x was 0 → 100
  fireEvent.mouseDown(rect, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: 40, clientY: 0 });
  fireEvent.mouseUp(svg, { clientX: 40, clientY: 0 });
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { x: 100, y: 0 }));
});

test('dragging furniture persists via placeItem keeping rotation', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.placeItem.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText('소파');
  const rect = screen.getByTestId('furn-5');
  const svg = screen.getByRole('img', { name: '평면도' });
  // move +0px x, +40px y → +100cm y; placement was (10,20) rot 0 → (10, 120)
  fireEvent.mouseDown(rect, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: 0, clientY: 40 });
  fireEvent.mouseUp(svg, { clientX: 0, clientY: 40 });
  await waitFor(() => expect(api.placeItem).toHaveBeenCalledWith(5, { x: 10, y: 120, rotation: 0 }));
});

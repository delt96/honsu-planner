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
    getHomeSettings: vi.fn(), saveHomeSettings: vi.fn(),
    createFeature: vi.fn(), updateFeature: vi.fn(), deleteFeature: vi.fn(),
  },
}));

const LAYOUT = {
  rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500 }],
  placements: [{ item_id: 5, name: '소파', category: 'furniture', x: 10, y: 20, rotation: 0, width_cm: 200, depth_cm: 90 }],
  palette: [{ item_id: 7, name: '식탁', category: 'furniture', width_cm: 120, depth_cm: 80 }],
  unplaceable: [{ item_id: 9, name: '스탠드', category: 'appliance' }],
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
  // move +60px in x → 60 / 0.6 = 100cm; room.x was 0 → 100
  fireEvent.mouseDown(rect, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: 60, clientY: 0 });
  fireEvent.mouseUp(svg, { clientX: 60, clientY: 0 });
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { x: 100, y: 0 }));
});

test('dragging furniture persists via placeItem keeping rotation', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.placeItem.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByText('소파');
  const rect = screen.getByTestId('furn-5');
  const svg = screen.getByRole('img', { name: '평면도' });
  // move +0px x, +60px y → +100cm y; placement was (10,20) rot 0 → (10, 120)
  fireEvent.mouseDown(rect, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(svg, { clientX: 0, clientY: 60 });
  fireEvent.mouseUp(svg, { clientX: 0, clientY: 60 });
  await waitFor(() => expect(api.placeItem).toHaveBeenCalledWith(5, { x: 10, y: 120, rotation: 0 }));
});

test('room card lists features and saves ceiling height', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500, ceiling_height_cm: null, features: [
      { id: 11, kind: 'outlet', wall: 'E', offset_cm: 150, width_cm: null, height_cm: null, sill_height_cm: null, floor_height_cm: 30, swing: null },
    ] }],
    placements: [], palette: [], unplaceable: [],
  });
  api.updateRoom.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  expect(await screen.findByText('동쪽 · 모서리 150cm · 바닥 30cm')).toBeInTheDocument();
  const inp = screen.getByLabelText('거실 천장 높이');
  await userEvent.type(inp, '240');
  await userEvent.tab();
  await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith(1, { ceiling_height_cm: '240' }));
});

test('클릭 배치: 도구 선택 → 유령 표시 → 벽 클릭 → 기본치수로 생성', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  api.createFeature.mockResolvedValue({ id: 42 });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  // cursor at cm (200, 5): near room-1's N wall → ghost centered → offset 200-40=160
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 3 });
  expect(screen.getByTestId('feat-ghost')).toBeInTheDocument();
  expect(screen.getAllByText('160')).toHaveLength(2); // corner distances on both sides
  fireEvent.click(svg, { clientX: 120, clientY: 3 });
  await waitFor(() => expect(api.createFeature).toHaveBeenCalledWith(1, {
    kind: 'door', wall: 'N', offset_cm: 160, width_cm: 80, height_cm: 204, swing: 'in-left',
  }));
});

test('벽에서 먼 곳에서는 유령이 없고 클릭해도 생성되지 않는다', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '⚡ 콘센트' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 150 }); // cm (200, 250): room center
  expect(screen.queryByTestId('feat-ghost')).not.toBeInTheDocument();
  fireEvent.click(svg, { clientX: 120, clientY: 150 });
  expect(api.createFeature).not.toHaveBeenCalled();
});

test('ESC가 배치 모드를 종료한다', async () => {
  api.getLayout.mockResolvedValue(LAYOUT);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-1');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' }));
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 120, clientY: 3 });
  expect(screen.getByTestId('feat-ghost')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByTestId('feat-ghost')).not.toBeInTheDocument();
  fireEvent.click(svg, { clientX: 120, clientY: 3 });
  expect(api.createFeature).not.toHaveBeenCalled();
});

test('벽보다 넓은 부착물 유령은 invalid로 표시되고 클릭이 무시된다', async () => {
  api.getLayout.mockResolvedValue({
    rooms: [{ id: 3, name: '팬트리', x: 0, y: 0, width_cm: 60, depth_cm: 60 }],
    placements: [], palette: [], unplaceable: [],
  });
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  await screen.findByTestId('room-3');
  await userEvent.click(screen.getByRole('button', { name: '🚪 문' })); // door 80 > wall 60
  const svg = screen.getByRole('img', { name: '평면도' });
  fireEvent.mouseMove(svg, { clientX: 18, clientY: 3 }); // cm (30, 5): N wall
  expect(screen.getByTestId('feat-ghost').closest('g.feat-ghost')).toHaveClass('invalid');
  fireEvent.click(svg, { clientX: 18, clientY: 3 });
  expect(api.createFeature).not.toHaveBeenCalled();
});

const FEAT_LAYOUT = {
  rooms: [{ id: 1, name: '거실', x: 0, y: 0, width_cm: 400, depth_cm: 500, ceiling_height_cm: null, features: [
    { id: 11, kind: 'window', wall: 'N', offset_cm: 90, width_cm: 180, height_cm: 120, sill_height_cm: 90, floor_height_cm: null, swing: null },
    { id: 12, kind: 'door', wall: 'S', offset_cm: 30, width_cm: 80, height_cm: 204, sill_height_cm: null, floor_height_cm: null, swing: 'in-left' },
  ] }],
  placements: [], palette: [], unplaceable: [],
};

test('기호 클릭 → 속성 카드: 오른쪽 모서리 입력이 offset으로 환산 저장된다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.updateFeature.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-11'));
  const card = screen.getByTestId('feat-card-11');
  const right = within(card).getByLabelText('오른쪽 모서리에서');
  expect(right).toHaveValue('130'); // 400 - 90 - 180
  await userEvent.clear(right);
  await userEvent.type(right, '100');
  await userEvent.tab();
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(11, { offset_cm: 120 })); // 400 - 180 - 100
});

test('문 열림 토글은 즉시 저장된다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.updateFeature.mockResolvedValue({});
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-12'));
  await userEvent.click(within(screen.getByTestId('feat-card-12')).getByRole('button', { name: '밖' }));
  await waitFor(() => expect(api.updateFeature).toHaveBeenCalledWith(12, { swing: 'out-left' }));
});

test('카드의 삭제 버튼이 deleteFeature를 호출하고 카드를 닫는다', async () => {
  api.getLayout.mockResolvedValue(FEAT_LAYOUT);
  api.deleteFeature.mockResolvedValue(null);
  render(<MemoryRouter><LayoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId('feat-11'));
  await userEvent.click(within(screen.getByTestId('feat-card-11')).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(api.deleteFeature).toHaveBeenCalledWith(11));
  expect(screen.queryByTestId('feat-card-11')).not.toBeInTheDocument();
});

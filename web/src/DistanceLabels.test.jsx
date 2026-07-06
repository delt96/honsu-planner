import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { DistanceLabels } from './DistanceLabels.jsx';

const ROOM = { x: 0, y: 0, width_cm: 400, depth_cm: 300 };

test('shows distances from the feature to both wall corners', () => {
  render(<svg><DistanceLabels room={ROOM} wall="N" offsetCm={130} widthCm={60} /></svg>);
  expect(screen.getByText('130')).toBeInTheDocument();
  expect(screen.getByText('210')).toBeInTheDocument(); // 400 - 130 - 60
});

test('omits a zero-length side', () => {
  render(<svg><DistanceLabels room={ROOM} wall="N" offsetCm={0} widthCm={60} /></svg>);
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(screen.getByText('340')).toBeInTheDocument();
});

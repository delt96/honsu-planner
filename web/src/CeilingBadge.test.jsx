import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { CeilingBadge } from './CeilingBadge.jsx';

test('warns when the item is taller than the lowest ceiling', () => {
  render(<CeilingBadge heightCm={250} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(screen.getByText('천장 초과')).toBeInTheDocument();
});

test('renders nothing when it fits or data is missing', () => {
  const { container: a } = render(<CeilingBadge heightCm={200} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(a).toBeEmptyDOMElement();
  const { container: b } = render(<CeilingBadge heightCm={250} settings={{ min_ceiling_height_cm: null }} />);
  expect(b).toBeEmptyDOMElement();
  const { container: c } = render(<CeilingBadge heightCm={null} settings={{ min_ceiling_height_cm: 235 }} />);
  expect(c).toBeEmptyDOMElement();
});

import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders plinko game controls', () => {
  render(<App />);
  expect(screen.getAllByText(/^plinko$/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /drop ball/i })).toBeDefined();
});

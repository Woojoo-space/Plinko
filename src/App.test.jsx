import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders plinko game controls', () => {
  render(<App />);
  expect(screen.getByText(/plinko rush/i)).toBeDefined();
  expect(screen.getByRole('button', { name: /drop ball/i })).toBeDefined();
});

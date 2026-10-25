/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../src/App';

afterEach(cleanup);

describe('App', () => {
  it('제목 "연차 플래너"를 보여줘요', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '연차 플래너' })).toBeTruthy();
  });
});

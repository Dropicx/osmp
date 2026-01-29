import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingSkeleton from '../Library/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton elements', () => {
    const { container } = render(<LoadingSkeleton />);
    const skeletonElements = container.querySelectorAll('.skeleton');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders toolbar skeleton area', () => {
    const { container } = render(<LoadingSkeleton />);
    // The toolbar area has specific skeleton widths
    const toolbar = container.querySelector('.flex.items-center.gap-3');
    expect(toolbar).toBeTruthy();
  });

  it('renders 12 skeleton rows', () => {
    const { container } = render(<LoadingSkeleton />);
    // Each row has border-b class and items-center
    const rows = container.querySelectorAll('.flex.items-center.gap-4.px-4.py-3');
    // 1 header + 12 data rows
    expect(rows.length).toBe(13);
  });

  it('renders skeleton rows with varying title widths', () => {
    const { container } = render(<LoadingSkeleton />);
    const styledElements = container.querySelectorAll('[style]');
    // There should be styled elements with varying widths
    expect(styledElements.length).toBeGreaterThan(0);
  });
});

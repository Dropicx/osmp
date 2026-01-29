import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// A component that throws
function ThrowingComponent({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected error throws
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test error')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('shows generic message without error details', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Some crash')} />
      </ErrorBoundary>
    );

    expect(
      screen.getByText('An unexpected error occurred. Try reloading the view.')
    ).toBeInTheDocument();
  });

  it('displays Try Again button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('crash')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    let shouldThrow = true;
    const ConditionalThrow = () => {
      if (shouldThrow) throw new Error('crash');
      return <div>Child content</div>;
    };

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click Try Again and stop throwing
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});

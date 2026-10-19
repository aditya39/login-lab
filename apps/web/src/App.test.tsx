import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Login Lab' })).toBeInTheDocument();
  });

  it('shows an error for an invalid email', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email tidak valid');
  });

  it('shows no error for a valid email', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatsCards } from '../components/dashboard/stats-cards';
import { jsonResponse, renderWithQueryClient } from './test-utils';

const stats = {
  developers: 12,
  onBench: 1,
  assigned: 11,
  clients: 6,
  activeContracts: 9,
  expiringContracts: 3,
  openAlerts: 4,
  benchOver14Days: 1,
  conversations: 2,
  utilizationRate: 92,
  updatedAt: '2026-11-07T00:00:00.000Z',
};

describe('StatsCards', () => {
  it('renders live dashboard statistics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(stats)),
    );

    renderWithQueryClient(<StatsCards />);

    expect(screen.getByLabelText('Loading dashboard stats')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('Developers')).toBeInTheDocument();
    expect(screen.getByText('On Bench')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Active contracts:')).toBeInTheDocument();
  });

  it('surfaces API errors and offers a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Stats failed' }, { status: 500 })),
    );

    renderWithQueryClient(<StatsCards />);

    expect(await screen.findByText('Stats failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Tags,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped nav from docs/tally-dashboard.html (Main / Other).
export const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/accounts', label: 'Accounts', icon: Wallet },
      { href: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
      { href: '/categories', label: 'Categories', icon: Tags },
    ],
  },
  {
    label: 'Other',
    items: [{ href: '/settings', label: 'Settings', icon: Settings2 }],
  },
];

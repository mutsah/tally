import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Tags,
  BarChart3,
  Download,
  Settings2,
  HelpCircle,
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

// Grouped nav from docs/tally-dashboard.html (Main / Manage / Other).
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
    label: 'Manage',
    items: [
      { href: '/valuations', label: 'Valuations', icon: BarChart3 },
      { href: '/export', label: 'Export', icon: Download },
    ],
  },
  {
    label: 'Other',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings2 },
      { href: '/help', label: 'Help', icon: HelpCircle },
    ],
  },
];

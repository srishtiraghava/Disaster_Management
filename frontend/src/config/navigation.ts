import {
  Activity,
  BarChart3,
  BellRing,
  Compass,
  Cpu,
  History,
  LayoutDashboard,
  Mountain,
  Radio,
  ShieldCheck,
  Siren,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  section: 'COMMAND CENTER' | 'OPERATIONS' | 'SYSTEM'
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    section: 'COMMAND CENTER',
    description: 'Grid posture, peak risks, active sirens, and recent system events',
  },
  {
    id: 'monitoring',
    label: 'Live Monitoring',
    path: '/monitoring',
    icon: Radio,
    section: 'COMMAND CENTER',
    description: 'Real-time station telemetry across five Himalayan districts',
  },
  {
    id: 'simulation',
    label: 'Simulation Center',
    path: '/simulation',
    icon: Cpu,
    section: 'OPERATIONS',
    description: 'Execute 6 threat scenarios or inject validated manual telemetry',
  },
  {
    id: 'hazards',
    label: 'Regional Hazard Analysis',
    path: '/hazards',
    icon: Mountain,
    section: 'OPERATIONS',
    description: 'Ranked RegionalHazard severity and overloaded hazard indices',
  },
  {
    id: 'alerts',
    label: 'Emergency Alerts',
    path: '/alerts',
    icon: BellRing,
    section: 'OPERATIONS',
    description: 'Active regional warnings, offline flags, and alert transition log',
  },
  {
    id: 'sirens',
    label: 'Siren Control',
    path: '/sirens',
    icon: Siren,
    section: 'OPERATIONS',
    description: 'Regional EarlyWarningSiren states and globalAlertLevel monitoring',
  },
  {
    id: 'evacuation',
    label: 'Evacuation Planning',
    path: '/evacuation',
    icon: Compass,
    section: 'OPERATIONS',
    description: 'Prioritized evacuation corridors and blocked route exclusions',
  },
  {
    id: 'incidents',
    label: 'Incident History',
    path: '/incidents',
    icon: History,
    section: 'SYSTEM',
    description: 'Persistent 433-byte binary store with search and in-place updates',
  },
  {
    id: 'audit',
    label: 'Telemetry Audit',
    path: '/audit',
    icon: ShieldCheck,
    section: 'SYSTEM',
    description: 'TelemetryAuditor history, TelemetryBuffer snapshots, FNV-32 checksums',
  },
  {
    id: 'statistics',
    label: 'System Statistics',
    path: '/statistics',
    icon: BarChart3,
    section: 'SYSTEM',
    description: 'Aggregate risk distributions, battery health, and cycle metrics',
  },
  {
    id: 'diagnostics',
    label: 'System Diagnostics',
    path: '/diagnostics',
    icon: Activity,
    section: 'SYSTEM',
    description: '6-point C++17 OOP, polymorphism, and binary store self-test',
  },
]

export const NAV_SECTIONS: Array<NavItem['section']> = [
  'COMMAND CENTER',
  'OPERATIONS',
  'SYSTEM',
]

export type KPEntry = {
  employeeId: string;
  name: string;
  position: string;
};

export type Project = {
  id: string;
  name: string;
  upc: string;
  currentKP: KPEntry[];
  previousKP: KPEntry[];
  memberIds: string[];
};

const MOCK_PROJECTS: Project[] = [
  {
    id: 'P001',
    name: 'Digital Transformation Initiative',
    upc: 'DTI-2024-001',
    currentKP: [
      { employeeId: 'OFF-001', name: 'Sarah Mitchell', position: 'Senior Manager' },
      { employeeId: 'OFF-002', name: 'James Chen', position: 'Director' },
    ],
    previousKP: [
      { employeeId: 'OFF-005', name: 'Priya Sharma', position: 'Manager' },
    ],
    memberIds: ['EMP-001', 'EMP-002', 'EMP-003'],
  },
  {
    id: 'P002',
    name: 'Risk & Compliance Framework',
    upc: 'RCF-2025-002',
    currentKP: [
      { employeeId: 'OFF-003', name: 'Arjun Nair', position: 'Associate Director' },
    ],
    previousKP: [
      { employeeId: 'OFF-006', name: 'Emily Watson', position: 'Senior Manager' },
      { employeeId: 'OFF-007', name: 'Ravi Kumar', position: 'Director' },
    ],
    memberIds: ['EMP-004', 'EMP-005'],
  },
  {
    id: 'P003',
    name: 'Cloud Migration Program',
    upc: 'CMP-2025-003',
    currentKP: [
      { employeeId: 'OFF-004', name: 'Lisa Fernandez', position: 'Partner' },
      { employeeId: 'OFF-008', name: 'David Park', position: 'Senior Manager' },
      { employeeId: 'OFF-009', name: 'Neha Gupta', position: 'Manager' },
    ],
    previousKP: [],
    memberIds: ['EMP-006', 'EMP-007', 'EMP-008', 'EMP-009'],
  },
  {
    id: 'P004',
    name: 'Data Analytics Platform',
    upc: 'DAP-2024-004',
    currentKP: [
      { employeeId: 'OFF-002', name: 'James Chen', position: 'Director' },
    ],
    previousKP: [
      { employeeId: 'OFF-010', name: 'Aisha Malik', position: 'Manager' },
    ],
    memberIds: ['EMP-010', 'EMP-011'],
  },
];

export function getAllProjects(): Project[] {
  return MOCK_PROJECTS;
}

export function getProjectForEmployee(employeeId: string): Project | null {
  return MOCK_PROJECTS.find(p => p.memberIds.includes(employeeId)) ?? null;
}

export function getProjectsForOfficial(employeeId: string): Project[] {
  return MOCK_PROJECTS.filter(p =>
    p.currentKP.some(kp => kp.employeeId === employeeId) ||
    p.previousKP.some(kp => kp.employeeId === employeeId)
  );
}

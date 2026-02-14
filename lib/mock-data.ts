export type MockConnection = {
  id: string;
  tenantName: string;
  principalName: string;
  status: "active" | "error";
  tokenExpiresAt: string;
};

export type MockCalendarEvent = {
  id: string;
  tenantName: string;
  sourceAccount: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  attendees: string[];
};

export type MockPerson = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
};

export const mockConnections: MockConnection[] = [
  {
    id: "conn-1",
    tenantName: "Primary Tenant",
    principalName: "you@primary.contoso.com",
    status: "active",
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  },
  {
    id: "conn-2",
    tenantName: "Partner Tenant",
    principalName: "you@partner.fabrikam.com",
    status: "active",
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
  }
];

export const mockCalendarEvents: MockCalendarEvent[] = [
  {
    id: "evt-1",
    tenantName: "Primary Tenant",
    sourceAccount: "you@primary.contoso.com",
    subject: "Weekly Product Sync",
    startAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
    location: "Microsoft Teams",
    attendees: ["pm@primary.contoso.com", "design@primary.contoso.com", "dev@primary.contoso.com"]
  },
  {
    id: "evt-2",
    tenantName: "Partner Tenant",
    sourceAccount: "you@partner.fabrikam.com",
    subject: "Partner Forecast Review",
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    location: "Conf Room B",
    attendees: ["saleslead@partner.fabrikam.com", "finance@partner.fabrikam.com"]
  },
  {
    id: "evt-3",
    tenantName: "Primary Tenant",
    sourceAccount: "you@primary.contoso.com",
    subject: "1:1 with Design",
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    location: "Teams",
    attendees: ["designlead@primary.contoso.com"]
  }
];

export const mockPeople: MockPerson[] = [
  {
    id: "p-1",
    displayName: "김민수",
    mail: "minsu@primary.contoso.com",
    jobTitle: "Platform Engineer",
    department: "Platform",
    tenantName: "Primary Tenant"
  },
  {
    id: "p-2",
    displayName: "Alex Chen",
    mail: "alex@partner.fabrikam.com",
    jobTitle: "Sales Lead",
    department: "Sales",
    tenantName: "Partner Tenant"
  },
  {
    id: "p-3",
    displayName: "윤아린",
    mail: "arin@primary.contoso.com",
    jobTitle: "Product Ops",
    department: "Product",
    tenantName: "Primary Tenant"
  },
  {
    id: "p-4",
    displayName: "Sofia Park",
    mail: "sofia@partner.fabrikam.com",
    jobTitle: "HR Manager",
    department: "People",
    tenantName: "Partner Tenant"
  }
];

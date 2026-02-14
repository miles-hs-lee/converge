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
  officeLocation: string;
  mobilePhone: string;
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
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString()
  },
  {
    id: "conn-3",
    tenantName: "Regional Tenant",
    principalName: "you@regional.adatum.com",
    status: "active",
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString()
  }
];

const eventTemplates = [
  { subject: "Product Sync", location: "Microsoft Teams" },
  { subject: "Engineering Review", location: "Conference A" },
  { subject: "Sales Pipeline", location: "Conference B" },
  { subject: "Hiring Interview", location: "Interview Room" },
  { subject: "Customer Onboarding", location: "Teams" },
  { subject: "Quarterly Planning", location: "HQ 4F" }
];

const tenantAccounts = [
  { tenantName: "Primary Tenant", sourceAccount: "you@primary.contoso.com" },
  { tenantName: "Partner Tenant", sourceAccount: "you@partner.fabrikam.com" },
  { tenantName: "Regional Tenant", sourceAccount: "you@regional.adatum.com" }
];

function createFutureMockEvents(count: number): MockCalendarEvent[] {
  const base = new Date();
  const events: MockCalendarEvent[] = [];

  for (let i = 0; i < count; i += 1) {
    const template = eventTemplates[i % eventTemplates.length];
    const tenant = tenantAccounts[i % tenantAccounts.length];
    const daysOffset = 2 + i * 6;

    const start = new Date(base);
    start.setDate(start.getDate() + daysOffset);
    start.setHours(9 + (i % 6), (i % 2) * 30, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60 + (i % 3) * 15);

    events.push({
      id: `evt-future-${i + 1}`,
      tenantName: tenant.tenantName,
      sourceAccount: tenant.sourceAccount,
      subject: `${template.subject} #${i + 1}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location: template.location,
      attendees: [
        `owner${(i % 8) + 1}@example.com`,
        `member${(i % 10) + 1}@example.com`,
        `partner${(i % 6) + 1}@example.com`
      ]
    });
  }

  return events;
}

function createPastMockEvents(count: number): MockCalendarEvent[] {
  const base = new Date();
  const events: MockCalendarEvent[] = [];

  for (let i = 0; i < count; i += 1) {
    const template = eventTemplates[(i + 2) % eventTemplates.length];
    const tenant = tenantAccounts[(i + 1) % tenantAccounts.length];
    const daysOffset = (i + 1) * 3;

    const start = new Date(base);
    start.setDate(start.getDate() - daysOffset);
    start.setHours(10 + (i % 4), 0, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 45);

    events.push({
      id: `evt-past-${i + 1}`,
      tenantName: tenant.tenantName,
      sourceAccount: tenant.sourceAccount,
      subject: `${template.subject} Recap #${i + 1}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location: template.location,
      attendees: [`lead${i + 1}@example.com`, `member${i + 1}@example.com`]
    });
  }

  return events;
}

export const mockCalendarEvents: MockCalendarEvent[] = [...createPastMockEvents(8), ...createFutureMockEvents(30)];

const peopleSeed: Array<{
  displayName: string;
  tenantName: string;
  department: string;
  jobTitle: string;
  officeLocation: string;
}> = [
  { displayName: "김민수", tenantName: "Primary Tenant", department: "Platform", jobTitle: "Platform Engineer", officeLocation: "Seoul" },
  { displayName: "Alex Chen", tenantName: "Partner Tenant", department: "Sales", jobTitle: "Sales Lead", officeLocation: "Busan" },
  { displayName: "윤아린", tenantName: "Primary Tenant", department: "Product", jobTitle: "Product Ops", officeLocation: "Seoul" },
  { displayName: "Sofia Park", tenantName: "Partner Tenant", department: "People", jobTitle: "HR Manager", officeLocation: "Incheon" },
  { displayName: "최서연", tenantName: "Regional Tenant", department: "Marketing", jobTitle: "Marketing Manager", officeLocation: "Daegu" },
  { displayName: "이재훈", tenantName: "Primary Tenant", department: "Platform", jobTitle: "Backend Engineer", officeLocation: "Seoul" },
  { displayName: "박지후", tenantName: "Partner Tenant", department: "Sales", jobTitle: "Account Executive", officeLocation: "Busan" },
  { displayName: "정하늘", tenantName: "Regional Tenant", department: "Support", jobTitle: "Support Specialist", officeLocation: "Daejeon" },
  { displayName: "강도윤", tenantName: "Primary Tenant", department: "Data", jobTitle: "Data Analyst", officeLocation: "Seoul" },
  { displayName: "오지민", tenantName: "Partner Tenant", department: "Finance", jobTitle: "Finance Partner", officeLocation: "Busan" },
  { displayName: "한유진", tenantName: "Regional Tenant", department: "People", jobTitle: "Recruiter", officeLocation: "Gwangju" },
  { displayName: "신현우", tenantName: "Primary Tenant", department: "Security", jobTitle: "Security Engineer", officeLocation: "Seoul" },
  { displayName: "임세진", tenantName: "Partner Tenant", department: "Operations", jobTitle: "Ops Manager", officeLocation: "Incheon" },
  { displayName: "유태민", tenantName: "Regional Tenant", department: "Engineering", jobTitle: "Frontend Engineer", officeLocation: "Daegu" },
  { displayName: "배주원", tenantName: "Primary Tenant", department: "Product", jobTitle: "Product Manager", officeLocation: "Seoul" },
  { displayName: "조하린", tenantName: "Partner Tenant", department: "Marketing", jobTitle: "Growth Marketer", officeLocation: "Busan" },
  { displayName: "송지호", tenantName: "Regional Tenant", department: "Support", jobTitle: "Escalation Engineer", officeLocation: "Daejeon" },
  { displayName: "문서윤", tenantName: "Primary Tenant", department: "Data", jobTitle: "BI Engineer", officeLocation: "Seoul" },
  { displayName: "홍민재", tenantName: "Partner Tenant", department: "Sales", jobTitle: "Sales Ops", officeLocation: "Incheon" },
  { displayName: "서다은", tenantName: "Regional Tenant", department: "Finance", jobTitle: "Accountant", officeLocation: "Gwangju" },
  { displayName: "김태양", tenantName: "Primary Tenant", department: "Security", jobTitle: "Compliance Lead", officeLocation: "Seoul" },
  { displayName: "이수빈", tenantName: "Partner Tenant", department: "Operations", jobTitle: "Program Manager", officeLocation: "Busan" },
  { displayName: "박은호", tenantName: "Regional Tenant", department: "Engineering", jobTitle: "QA Engineer", officeLocation: "Daegu" },
  { displayName: "정다인", tenantName: "Primary Tenant", department: "Platform", jobTitle: "SRE", officeLocation: "Seoul" },
  { displayName: "장유나", tenantName: "Partner Tenant", department: "People", jobTitle: "People Partner", officeLocation: "Incheon" },
  { displayName: "최준혁", tenantName: "Regional Tenant", department: "Marketing", jobTitle: "Content Strategist", officeLocation: "Daejeon" },
  { displayName: "강나래", tenantName: "Primary Tenant", department: "Product", jobTitle: "UX Researcher", officeLocation: "Seoul" },
  { displayName: "오현석", tenantName: "Partner Tenant", department: "Sales", jobTitle: "Customer Success", officeLocation: "Busan" },
  { displayName: "한주아", tenantName: "Regional Tenant", department: "Support", jobTitle: "Support Lead", officeLocation: "Gwangju" },
  { displayName: "임도윤", tenantName: "Primary Tenant", department: "Engineering", jobTitle: "Fullstack Engineer", officeLocation: "Seoul" },
  { displayName: "유채린", tenantName: "Partner Tenant", department: "Finance", jobTitle: "Controller", officeLocation: "Incheon" },
  { displayName: "배시온", tenantName: "Regional Tenant", department: "Operations", jobTitle: "Operations Analyst", officeLocation: "Daegu" },
  { displayName: "조민준", tenantName: "Primary Tenant", department: "Data", jobTitle: "Data Scientist", officeLocation: "Seoul" },
  { displayName: "송예린", tenantName: "Partner Tenant", department: "Marketing", jobTitle: "Brand Manager", officeLocation: "Busan" }
];

export const mockPeople: MockPerson[] = peopleSeed.map((person, index) => {
  const local = person.displayName.toLowerCase().replace(/\s+/g, "");
  return {
    id: `p-${index + 1}`,
    displayName: person.displayName,
    mail: `${local}${index + 1}@example.com`,
    jobTitle: person.jobTitle,
    department: person.department,
    tenantName: person.tenantName,
    officeLocation: `${person.officeLocation} Office`,
    mobilePhone: `010-${String(1000 + index).padStart(4, "0")}-${String(2000 + index).padStart(4, "0")}`
  };
});

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
  organizer?: string;
  isAllDay?: boolean;
  webLink?: string | null;
  lastModifiedAt?: string | null;
  calendarName?: string;
  provider?: string;
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
  businessPhones: string[];
  sourceAccount: string;
  provider: string;
  upn: string;
  externalPersonId: string;
  managerExternalId: string;
  companyName: string;
  employeeId: string;
  preferredLanguage: string;
  city: string;
  state: string;
  country: string;
  userType: string;
  accountEnabled: boolean | null;
};

export const mockConnections: MockConnection[] = [
  {
    id: "conn-1",
    tenantName: "Primary Account",
    principalName: "you@primary.contoso.com",
    status: "active",
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  },
  {
    id: "conn-2",
    tenantName: "Partner Account",
    principalName: "you@partner.fabrikam.com",
    status: "active",
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString()
  },
  {
    id: "conn-3",
    tenantName: "Regional Account",
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
  { tenantName: "Primary Account", sourceAccount: "you@primary.contoso.com" },
  { tenantName: "Partner Account", sourceAccount: "you@partner.fabrikam.com" },
  { tenantName: "Regional Account", sourceAccount: "you@regional.adatum.com" }
];

function calendarNameForTenant(tenantName: string): string {
  if (tenantName === "Partner Account") return "Partner Shared Calendar";
  if (tenantName === "Regional Account") return "Regional Operations Calendar";
  return "Primary Calendar";
}

function createBusyMockEvents(): MockCalendarEvent[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  const days = [0, 1, 2];
  const slots = [
    { title: "Daily Standup", hour: 9, minute: 10, durationMin: 20, location: "Teams" },
    { title: "1:1", hour: 10, minute: 30, durationMin: 30, location: "Meeting Room 3" },
    { title: "Project Review", hour: 14, minute: 0, durationMin: 60, location: "Conference A" }
  ];

  const events: MockCalendarEvent[] = [];
  let seq = 1;

  for (const dayOffset of days) {
    for (const tenant of tenantAccounts) {
      for (const [slotIndex, slot] of slots.entries()) {
        const start = new Date(base);
        start.setDate(start.getDate() + dayOffset);
        start.setHours(slot.hour, slot.minute, 0, 0);

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + slot.durationMin);

        const attendeeBase = `${tenant.tenantName.replace(/\s+/g, "").toLowerCase()}.example.com`;
        const attendees = [
          `lead+${seq}@${attendeeBase}`,
          `member+${seq}@${attendeeBase}`,
          `partner+${(slotIndex % 6) + 1}@example.com`
        ];

        events.push({
          id: `evt-busy-${seq}`,
          tenantName: tenant.tenantName,
          sourceAccount: tenant.sourceAccount,
          subject: `${slot.title} · ${tenant.tenantName}`,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          location: slot.location,
          attendees,
          organizer: tenant.sourceAccount,
          isAllDay: false,
          webLink: `https://outlook.office.com/calendar/item/evt-busy-${seq}`,
          lastModifiedAt: new Date(start.getTime() - 1000 * 60 * 50).toISOString(),
          calendarName: calendarNameForTenant(tenant.tenantName),
          provider: "microsoft"
        });
        seq += 1;
      }
    }

    // A shared cross-tenant slot (same time across tenants) to test collisions.
    const sharedStart = new Date(base);
    sharedStart.setDate(sharedStart.getDate() + dayOffset);
    sharedStart.setHours(11, 0, 0, 0);
    const sharedEnd = new Date(sharedStart);
    sharedEnd.setMinutes(sharedEnd.getMinutes() + 45);

    tenantAccounts.forEach((tenant) => {
      events.push({
        id: `evt-busy-${seq}`,
        tenantName: tenant.tenantName,
        sourceAccount: tenant.sourceAccount,
        subject: `All Hands · ${tenant.tenantName}`,
        startAt: sharedStart.toISOString(),
        endAt: sharedEnd.toISOString(),
        location: "Auditorium / Teams",
        attendees: ["all@example.com", "ops@example.com"],
        organizer: tenant.sourceAccount,
        isAllDay: false,
        webLink: `https://outlook.office.com/calendar/item/evt-busy-${seq}`,
        lastModifiedAt: new Date(sharedStart.getTime() - 1000 * 60 * 30).toISOString(),
        calendarName: calendarNameForTenant(tenant.tenantName),
        provider: "microsoft"
      });
      seq += 1;
    });
  }

  return events;
}

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
      ],
      organizer: tenant.sourceAccount,
      isAllDay: false,
      webLink: `https://outlook.office.com/calendar/item/evt-future-${i + 1}`,
      lastModifiedAt: new Date(start.getTime() - 1000 * 60 * (15 + (i % 7) * 5)).toISOString(),
      calendarName: calendarNameForTenant(tenant.tenantName),
      provider: "microsoft"
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
      attendees: [`lead${i + 1}@example.com`, `member${i + 1}@example.com`],
      organizer: tenant.sourceAccount,
      isAllDay: false,
      webLink: `https://outlook.office.com/calendar/item/evt-past-${i + 1}`,
      lastModifiedAt: new Date(end.getTime() - 1000 * 60 * 20).toISOString(),
      calendarName: calendarNameForTenant(tenant.tenantName),
      provider: "microsoft"
    });
  }

  return events;
}

export const mockCalendarEvents: MockCalendarEvent[] = [...createPastMockEvents(8), ...createBusyMockEvents(), ...createFutureMockEvents(30)];

const peopleSeed: Array<{
  displayName: string;
  tenantName: string;
  department: string;
  jobTitle: string;
  officeLocation: string;
}> = [
  { displayName: "김민수", tenantName: "Primary Account", department: "Platform", jobTitle: "Platform Engineer", officeLocation: "Seoul" },
  { displayName: "Alex Chen", tenantName: "Partner Account", department: "Sales", jobTitle: "Sales Lead", officeLocation: "Busan" },
  { displayName: "윤아린", tenantName: "Primary Account", department: "Product", jobTitle: "Product Ops", officeLocation: "Seoul" },
  { displayName: "Sofia Park", tenantName: "Partner Account", department: "People", jobTitle: "HR Manager", officeLocation: "Incheon" },
  { displayName: "최서연", tenantName: "Regional Account", department: "Marketing", jobTitle: "Marketing Manager", officeLocation: "Daegu" },
  { displayName: "이재훈", tenantName: "Primary Account", department: "Platform", jobTitle: "Backend Engineer", officeLocation: "Seoul" },
  { displayName: "박지후", tenantName: "Partner Account", department: "Sales", jobTitle: "Account Executive", officeLocation: "Busan" },
  { displayName: "정하늘", tenantName: "Regional Account", department: "Support", jobTitle: "Support Specialist", officeLocation: "Daejeon" },
  { displayName: "강도윤", tenantName: "Primary Account", department: "Data", jobTitle: "Data Analyst", officeLocation: "Seoul" },
  { displayName: "오지민", tenantName: "Partner Account", department: "Finance", jobTitle: "Finance Partner", officeLocation: "Busan" },
  { displayName: "한유진", tenantName: "Regional Account", department: "People", jobTitle: "Recruiter", officeLocation: "Gwangju" },
  { displayName: "신현우", tenantName: "Primary Account", department: "Security", jobTitle: "Security Engineer", officeLocation: "Seoul" },
  { displayName: "임세진", tenantName: "Partner Account", department: "Operations", jobTitle: "Ops Manager", officeLocation: "Incheon" },
  { displayName: "유태민", tenantName: "Regional Account", department: "Engineering", jobTitle: "Frontend Engineer", officeLocation: "Daegu" },
  { displayName: "배주원", tenantName: "Primary Account", department: "Product", jobTitle: "Product Manager", officeLocation: "Seoul" },
  { displayName: "조하린", tenantName: "Partner Account", department: "Marketing", jobTitle: "Growth Marketer", officeLocation: "Busan" },
  { displayName: "송지호", tenantName: "Regional Account", department: "Support", jobTitle: "Escalation Engineer", officeLocation: "Daejeon" },
  { displayName: "문서윤", tenantName: "Primary Account", department: "Data", jobTitle: "BI Engineer", officeLocation: "Seoul" },
  { displayName: "홍민재", tenantName: "Partner Account", department: "Sales", jobTitle: "Sales Ops", officeLocation: "Incheon" },
  { displayName: "서다은", tenantName: "Regional Account", department: "Finance", jobTitle: "Accountant", officeLocation: "Gwangju" },
  { displayName: "김태양", tenantName: "Primary Account", department: "Security", jobTitle: "Compliance Lead", officeLocation: "Seoul" },
  { displayName: "이수빈", tenantName: "Partner Account", department: "Operations", jobTitle: "Program Manager", officeLocation: "Busan" },
  { displayName: "박은호", tenantName: "Regional Account", department: "Engineering", jobTitle: "QA Engineer", officeLocation: "Daegu" },
  { displayName: "정다인", tenantName: "Primary Account", department: "Platform", jobTitle: "SRE", officeLocation: "Seoul" },
  { displayName: "장유나", tenantName: "Partner Account", department: "People", jobTitle: "People Partner", officeLocation: "Incheon" },
  { displayName: "최준혁", tenantName: "Regional Account", department: "Marketing", jobTitle: "Content Strategist", officeLocation: "Daejeon" },
  { displayName: "강나래", tenantName: "Primary Account", department: "Product", jobTitle: "UX Researcher", officeLocation: "Seoul" },
  { displayName: "오현석", tenantName: "Partner Account", department: "Sales", jobTitle: "Customer Success", officeLocation: "Busan" },
  { displayName: "한주아", tenantName: "Regional Account", department: "Support", jobTitle: "Support Lead", officeLocation: "Gwangju" },
  { displayName: "임도윤", tenantName: "Primary Account", department: "Engineering", jobTitle: "Fullstack Engineer", officeLocation: "Seoul" },
  { displayName: "유채린", tenantName: "Partner Account", department: "Finance", jobTitle: "Controller", officeLocation: "Incheon" },
  { displayName: "배시온", tenantName: "Regional Account", department: "Operations", jobTitle: "Operations Analyst", officeLocation: "Daegu" },
  { displayName: "조민준", tenantName: "Primary Account", department: "Data", jobTitle: "Data Scientist", officeLocation: "Seoul" },
  { displayName: "송예린", tenantName: "Partner Account", department: "Marketing", jobTitle: "Brand Manager", officeLocation: "Busan" }
];

export const mockPeople: MockPerson[] = peopleSeed.map((person, index) => {
  const local = person.displayName.toLowerCase().replace(/\s+/g, "");
  const sourceAccount =
    person.tenantName === "Partner Account"
      ? "you@partner.fabrikam.com"
      : person.tenantName === "Regional Account"
        ? "you@regional.adatum.com"
        : "you@primary.contoso.com";

  return {
    id: `p-${index + 1}`,
    displayName: person.displayName,
    mail: `${local}${index + 1}@example.com`,
    jobTitle: person.jobTitle,
    department: person.department,
    tenantName: person.tenantName,
    officeLocation: `${person.officeLocation} Office`,
    mobilePhone: `010-${String(1000 + index).padStart(4, "0")}-${String(2000 + index).padStart(4, "0")}`,
    businessPhones: [`02-${String(3000 + (index % 100)).padStart(4, "0")}-${String(4000 + (index % 100)).padStart(4, "0")}`],
    sourceAccount,
    provider: "microsoft",
    upn: `${local}${index + 1}@contoso.onmicrosoft.com`,
    externalPersonId: `ext-person-${index + 1}`,
    managerExternalId: index % 5 === 0 ? "" : `ext-manager-${(index % 9) + 1}`,
    companyName: person.tenantName.replace("Account", "Corp"),
    employeeId: `E${String(10000 + index)}`,
    preferredLanguage: index % 3 === 0 ? "ko-KR" : index % 3 === 1 ? "en-US" : "ja-JP",
    city: person.officeLocation,
    state: "N/A",
    country: "KR",
    userType: "Member",
    accountEnabled: true
  };
});

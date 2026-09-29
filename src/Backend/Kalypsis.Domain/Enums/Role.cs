namespace Kalypsis.Domain.Enums;

public enum Role
{
    PlatformAdmin = 1,
    PlatformEmployee = 2,
    AgencyAdmin = 3,
    AgencyUser = 4,
    Producer = 5,
    Customer = 6,
    // Office-level administrator.  This role manages only employees in its
    // assigned office and can never administer the tenant or another office.
    AgencyOfficeAdmin = 13,
    // Federation module — a sports federation running on the same platform.
    // FederationAdmin manages championships / clubs / athletes / results;
    // FederationEmployee is the day-to-day operator (results entry, payment
    // check-in), tenant-scoped just like Agency* roles.
    FederationAdmin = 10,
    FederationEmployee = 11,
    // A club that participates in the federation's championships. Owns its
    // athletes and payment declarations, cannot see other clubs' data.
    ClubManager = 12
}

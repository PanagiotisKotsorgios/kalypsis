using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Xunit;

namespace Kalypsis.Tests;

public sealed class CustomerListFilterFactsTests
{
    [Fact]
    public async Task Customer_list_returns_the_facts_needed_by_desktop_parity_filters()
    {
        var tenantId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenantId);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer
        {
            Id = Guid.NewGuid(), TenantId = tenantId, CustomerNumber = "C-FILTER",
            Type = CustomerType.Individual, Status = CustomerStatus.Active,
            FirstName = "Μαρία", LastName = "Δοκιμή", City = "Αθήνα",
            BirthDate = new DateOnly(1986, 10, 21), CreatedAt = new DateTime(2026, 1, 10),
            UpdatedAt = new DateTime(2026, 10, 1), TagsJson = "[\"VIP\"]"
        };
        var child = new Customer
        {
            Id = Guid.NewGuid(), TenantId = tenantId, CustomerNumber = "C-CHILD",
            Type = CustomerType.Individual, FirstName = "Τέκνο", CreatedAt = new DateTime(2026, 1, 10)
        };
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenantId, Code = "P1", Name = "Συνεργάτης Α" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Ασφαλιστική" };
        db.Customers.AddRange(customer, child);
        db.Producers.Add(producer);
        db.InsuranceCompanies.Add(company);
        db.CustomerRelationships.Add(new CustomerRelationship
        {
            TenantId = tenantId, CustomerId = customer.Id, RelatedCustomerId = child.Id,
            RelationshipType = CustomerRelationshipType.Child
        });
        db.Policies.Add(new Policy
        {
            TenantId = tenantId, PolicyNumber = "POL-1", CustomerId = customer.Id,
            Customer = customer, ProducerId = producer.Id, Producer = producer,
            InsuranceCompanyId = company.Id, InsuranceCompany = company,
            PolicyType = PolicyType.Auto, StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2027, 1, 1), Currency = "EUR"
        });
        db.ConsentRecords.AddRange(
            new ConsentRecord
            {
                TenantId = tenantId, CustomerId = customer.Id, Type = ConsentType.PrivacyNotice,
                Granted = true, GrantedAt = new DateTime(2026, 1, 1), Method = ConsentMethod.PaperForm
            },
            new ConsentRecord
            {
                TenantId = tenantId, CustomerId = customer.Id, Type = ConsentType.EmailMarketing,
                Granted = true, GrantedAt = new DateTime(2026, 1, 1), Method = ConsentMethod.PaperForm
            },
            new ConsentRecord
            {
                TenantId = tenantId, CustomerId = customer.Id, Type = ConsentType.IddDemandsAndNeeds,
                Granted = true, GrantedAt = new DateTime(2026, 1, 1), Method = ConsentMethod.PaperForm
            });
        await db.SaveChangesAsync();

        var result = await new ListCustomersQueryHandler(db, current)
            .Handle(new ListCustomersQuery(null, Limit: 100), default);
        var row = Assert.Single(result, item => item.Id == customer.Id);

        Assert.Equal("Αθήνα", row.City);
        Assert.Equal(customer.BirthDate, row.BirthDate);
        Assert.Equal(customer.UpdatedAt, row.UpdatedAt);
        Assert.Equal(1, row.ChildrenCount);
        Assert.True(row.HasPolicy);
        Assert.True(row.HasGdprConsent);
        Assert.True(row.HasMarketingConsent);
        Assert.True(row.HasCommunicationConsent);
        Assert.True(row.HasNeedsForm);
        Assert.Equal(new[] { producer.Id }, row.ProducerIds);
        Assert.Equal(new[] { producer.Name }, row.ProducerNames);
    }
}

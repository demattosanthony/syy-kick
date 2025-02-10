import OrganizationsList from "../organizations/orgs-list";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <section>
        <OrganizationsList />
      </section>
    </div>
  );
}

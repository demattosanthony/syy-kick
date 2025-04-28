import { OrganizationsList } from "@/features/organizations/components";

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <section>
        <OrganizationsList />
      </section>
    </div>
  );
}

export default AdminSettings;
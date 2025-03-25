# api

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.26. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

---

# 🛠 User Roles and Permissions

## 👑 **ORGANIZATION_ADMIN**

- Full access to the entire organization and all projects.
- Can manage:
  - Organization settings
  - Organization invitations and members
  - Organization seats
  - Projects (CRUD)
  - Project documents (CRUD)
  - Project invitations (CRUD)
  - Project members (CRUD)

---

## 👥 **ORGANIZATION_MANAGER**

- Limited access to the organization.
- Can manage:
  - Organization invitations (CRUD)
  - View organization members and seats
  - Projects (CRUD)
  - Project documents (CRUD)
  - Project invitations (CRUD)
  - Project members (CRUD)

---

## 📂 **PROJECT_MANAGER**

- No access to organization settings.
- Can manage assigned projects:
  - Project (configured by the inviter)
  - Project documents (configured by the inviter)
  - Project invitations (configured by the inviter)
  - Project members (configured by the inviter)

---

## 👥 PROJECT_MEMBER (Internal or External)

- Configurable access set by the inviter.
- Configurable permissions :
  - Project documents (configured by the inviter)
  - Project invitations (configured by the inviter)
  - Project members (configured by the inviter)

---
-- Custom SQL migration file, put your code below! --
INSERT INTO
    resources (name, description)
VALUES
    (
        'org_access_logs',
        'Access logs for organizations'
    );

INSERT INTO
    permissions (member_role_id, resource_id, action_id)
SELECT
    mr.id AS member_role_id,
    (
        SELECT
            id
        FROM
            resources
        WHERE
            name = 'org_access_logs'
    ) AS resource_id,
    (
        SELECT
            id
        FROM
            actions
        WHERE
            name = 'read'
    ) AS action_id
FROM
    member_roles mr
    JOIN roles r ON mr.role_id = r.id
WHERE
    r.name IN ('ORGANIZATION_ADMIN', 'ORGANIZATION_MANAGER') ON CONFLICT (member_role_id, resource_id, action_id) DO NOTHING;
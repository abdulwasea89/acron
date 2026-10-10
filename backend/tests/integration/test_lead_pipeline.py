from uuid import uuid4

import pytest

from app.api.deps import get_tenant
from app.core.constants import Role, SaasStatus
from app.core.tenancy import TenantContext
from app.main import app
from app.models.organization import Organization
from app.models.user import User


@pytest.mark.asyncio
async def test_pipeline_api_permissions_replay_and_history(client, db):
    org = Organization(name="Pipeline", org_code="PIPELINE")
    other = Organization(name="Other", org_code="PIPELINE-OTHER")
    owner = User(email="pipeline@example.com", hashed_password="unused")
    db.add_all([org, other, owner])
    await db.commit()
    context = TenantContext(user_id=owner.id, org_id=org.id, role=Role.OWNER)
    app.dependency_overrides[get_tenant] = lambda: context
    response = await client.post("/api/v1/leads", json={"name": "Pipeline lead"},
                                 headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 201, response.text
    lead_id = response.json()["id"]
    endpoint = f"/api/v1/leads/{lead_id}"
    headers = {"Idempotency-Key": str(uuid4())}
    for _ in range(2):
        response = await client.patch(endpoint, json={"stage": "joined"}, headers=headers)
        assert response.status_code == 200, response.text
    history = await client.get(f"{endpoint}/history")
    assert history.status_code == 200
    assert history.json()["total"] == 2
    assert history.json()["items"][0]["previous_stage"] == "new"
    invalid = await client.patch(endpoint, json={"stage": "unknown"},
                                 headers={"Idempotency-Key": str(uuid4())})
    assert invalid.status_code == 422
    assert (await client.get(f"{endpoint}/history?page=0")).status_code == 422
    context = TenantContext(user_id=owner.id, org_id=org.id, role=Role.MEMBER)
    assert (await client.get(f"{endpoint}/history")).status_code == 403
    assert (await client.patch(endpoint, json={"stage": "lost"}, headers=headers)).status_code == 403
    context = TenantContext(user_id=owner.id, org_id=other.id, role=Role.OWNER)
    assert (await client.get(f"{endpoint}/history")).status_code == 404
    context = TenantContext(user_id=owner.id, org_id=org.id, role=Role.OWNER)
    org.saas_status = SaasStatus.READ_ONLY
    db.add(org)
    await db.commit()
    blocked = await client.patch(endpoint, json={"stage": "lost"},
                                 headers={"Idempotency-Key": str(uuid4())})
    assert blocked.status_code == 403
    assert (await client.get(f"{endpoint}/history")).json()["total"] == 2

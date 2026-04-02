"""
MsgRouter Platform API Tests
Tests for Node.js Express backend with JWT authentication
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@msgrouter.com"
ADMIN_PASSWORD = "admin123"

class TestHealthAndSeed:
    """Health check and seed data tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "MsgRouter" in data["message"]
        print(f"✓ API root: {data['message']}")
    
    def test_seed_data(self):
        """Test seed data endpoint"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Seed data: {data['message']}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid login rejected: {data['detail']}")
    
    def test_get_current_user(self):
        """Test GET /api/auth/me endpoint"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✓ Get current user: {data['email']}, role: {data['role']}")
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthorized access rejected")


class TestEnvironmentCRUD:
    """Environment CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_environments(self):
        """Test GET /api/environments"""
        response = requests.get(f"{BASE_URL}/api/environments", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get environments: {len(data)} environments found")
    
    def test_create_environment(self):
        """Test POST /api/environments"""
        env_data = {
            "name": "TEST_Environment",
            "address": "https://test.example.com:18443",
            "color": "#FF5733"
        }
        response = requests.post(
            f"{BASE_URL}/api/environments",
            json=env_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == env_data["name"]
        assert data["address"] == env_data["address"]
        assert "id" in data
        print(f"✓ Created environment: {data['name']} (id: {data['id']})")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/environments", headers=self.headers)
        envs = get_response.json()
        created_env = next((e for e in envs if e["id"] == data["id"]), None)
        assert created_env is not None
        assert created_env["name"] == env_data["name"]
        print(f"✓ Environment persisted and verified")
        
        return data["id"]
    
    def test_update_environment(self):
        """Test PUT /api/environments/:envId"""
        # First create an environment
        create_response = requests.post(
            f"{BASE_URL}/api/environments",
            json={"name": "TEST_UpdateEnv", "address": "https://update.test.com:18443", "color": "#123456"},
            headers=self.headers
        )
        env_id = create_response.json()["id"]
        
        # Update it
        update_data = {"name": "TEST_UpdatedEnv", "address": "https://updated.test.com:28443"}
        response = requests.put(
            f"{BASE_URL}/api/environments/{env_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["address"] == update_data["address"]
        print(f"✓ Updated environment: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/environments/{env_id}", headers=self.headers)
    
    def test_delete_environment(self):
        """Test DELETE /api/environments/:envId"""
        # First create an environment
        create_response = requests.post(
            f"{BASE_URL}/api/environments",
            json={"name": "TEST_DeleteEnv", "address": "https://delete.test.com:18443", "color": "#654321"},
            headers=self.headers
        )
        env_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/environments/{env_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted environment: {env_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/environments", headers=self.headers)
        envs = get_response.json()
        deleted_env = next((e for e in envs if e["id"] == env_id), None)
        assert deleted_env is None
        print(f"✓ Environment deletion verified")


class TestTenantCRUD:
    """Tenant CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create test environment"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get first environment for testing
        envs_response = requests.get(f"{BASE_URL}/api/environments", headers=self.headers)
        envs = envs_response.json()
        if envs:
            self.test_env_id = envs[0]["id"]
        else:
            # Create one if none exist
            create_response = requests.post(
                f"{BASE_URL}/api/environments",
                json={"name": "TEST_TenantTestEnv", "address": "https://tenant-test.com:18443", "color": "#AABBCC"},
                headers=self.headers
            )
            self.test_env_id = create_response.json()["id"]
    
    def test_get_tenants(self):
        """Test GET /api/tenants"""
        response = requests.get(f"{BASE_URL}/api/tenants", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get tenants: {len(data)} tenants found")
    
    def test_get_tenants_by_environment(self):
        """Test GET /api/tenants?environment_id=xxx"""
        response = requests.get(
            f"{BASE_URL}/api/tenants?environment_id={self.test_env_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get tenants by environment: {len(data)} tenants found")
    
    def test_create_tenant(self):
        """Test POST /api/tenants"""
        tenant_data = {
            "name": "TEST_Tenant",
            "environment_id": self.test_env_id,
            "port": 19443
        }
        response = requests.post(
            f"{BASE_URL}/api/tenants",
            json=tenant_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == tenant_data["name"]
        assert data["environment_id"] == self.test_env_id
        assert data["port"] == tenant_data["port"]
        assert "id" in data
        print(f"✓ Created tenant: {data['name']} (port: {data['port']})")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tenants/{data['id']}", headers=self.headers)
        return data["id"]
    
    def test_update_tenant(self):
        """Test PUT /api/tenants/:tenantId"""
        # Create tenant
        create_response = requests.post(
            f"{BASE_URL}/api/tenants",
            json={"name": "TEST_UpdateTenant", "environment_id": self.test_env_id, "port": 20443},
            headers=self.headers
        )
        tenant_id = create_response.json()["id"]
        
        # Update it
        update_data = {"name": "TEST_UpdatedTenant", "port": 21443}
        response = requests.put(
            f"{BASE_URL}/api/tenants/{tenant_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["port"] == update_data["port"]
        print(f"✓ Updated tenant: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tenants/{tenant_id}", headers=self.headers)
    
    def test_delete_tenant(self):
        """Test DELETE /api/tenants/:tenantId"""
        # Create tenant
        create_response = requests.post(
            f"{BASE_URL}/api/tenants",
            json={"name": "TEST_DeleteTenant", "environment_id": self.test_env_id, "port": 22443},
            headers=self.headers
        )
        tenant_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/tenants/{tenant_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted tenant: {tenant_id}")


class TestTemplateCRUD:
    """Template CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create test tenant"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get or create environment
        envs_response = requests.get(f"{BASE_URL}/api/environments", headers=self.headers)
        envs = envs_response.json()
        if envs:
            self.test_env_id = envs[0]["id"]
        else:
            create_env = requests.post(
                f"{BASE_URL}/api/environments",
                json={"name": "TEST_TemplateTestEnv", "address": "https://template-test.com:18443", "color": "#DDEEFF"},
                headers=self.headers
            )
            self.test_env_id = create_env.json()["id"]
        
        # Get or create tenant
        tenants_response = requests.get(f"{BASE_URL}/api/tenants", headers=self.headers)
        tenants = tenants_response.json()
        if tenants:
            self.test_tenant_id = tenants[0]["id"]
        else:
            create_tenant = requests.post(
                f"{BASE_URL}/api/tenants",
                json={"name": "TEST_TemplateTestTenant", "environment_id": self.test_env_id, "port": 23443},
                headers=self.headers
            )
            self.test_tenant_id = create_tenant.json()["id"]
    
    def test_get_templates(self):
        """Test GET /api/templates"""
        response = requests.get(f"{BASE_URL}/api/templates", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get templates: {len(data)} templates found")
    
    def test_create_template(self):
        """Test POST /api/templates"""
        template_data = {
            "name": "TEST_Template",
            "tenant_id": self.test_tenant_id,
            "body": "MSH|^~\\&|SENDER|FAC|RECEIVER|FAC|{{TIMESTAMP}}||ADT^A01|{{MSG_ID}}|P|2.3\nPID|||{{MRN}}||TEST^PATIENT||19800101|M"
        }
        response = requests.post(
            f"{BASE_URL}/api/templates",
            json=template_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["tenant_id"] == self.test_tenant_id
        assert "id" in data
        print(f"✓ Created template: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/templates/{data['id']}", headers=self.headers)
        return data["id"]
    
    def test_update_template(self):
        """Test PUT /api/templates/:templateId"""
        # Create template
        create_response = requests.post(
            f"{BASE_URL}/api/templates",
            json={"name": "TEST_UpdateTemplate", "tenant_id": self.test_tenant_id, "body": "MSH|TEST"},
            headers=self.headers
        )
        template_id = create_response.json()["id"]
        
        # Update it
        update_data = {"name": "TEST_UpdatedTemplate", "body": "MSH|UPDATED|TEST"}
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["body"] == update_data["body"]
        print(f"✓ Updated template: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/templates/{template_id}", headers=self.headers)
    
    def test_delete_template(self):
        """Test DELETE /api/templates/:templateId"""
        # Create template
        create_response = requests.post(
            f"{BASE_URL}/api/templates",
            json={"name": "TEST_DeleteTemplate", "tenant_id": self.test_tenant_id, "body": "MSH|DELETE"},
            headers=self.headers
        )
        template_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted template: {template_id}")


class TestMessageSending:
    """Message sending tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data for message sending"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get existing data
        envs = requests.get(f"{BASE_URL}/api/environments", headers=self.headers).json()
        tenants = requests.get(f"{BASE_URL}/api/tenants", headers=self.headers).json()
        templates = requests.get(f"{BASE_URL}/api/templates", headers=self.headers).json()
        
        self.env_id = envs[0]["id"] if envs else None
        self.tenant_id = tenants[0]["id"] if tenants else None
        self.template_id = templates[0]["id"] if templates else None
    
    def test_send_message(self):
        """Test POST /api/messages/send"""
        if not all([self.env_id, self.tenant_id, self.template_id]):
            pytest.skip("No test data available for message sending")
        
        message_data = {
            "environment_id": self.env_id,
            "tenant_id": self.tenant_id,
            "template_id": self.template_id,
            "mrn": "TEST-MRN-001",
            "visit_number": "TEST-VISIT-001",
            "room": "101",
            "bed": "A",
            "floor": "1"
        }
        response = requests.post(
            f"{BASE_URL}/api/messages/send",
            json=message_data,
            headers=self.headers,
            timeout=35  # Allow for 30s timeout in message sending
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "audit_id" in data
        assert data["status"] in ["sent", "failed"]  # External endpoints may fail
        print(f"✓ Message send attempted: status={data['status']}, audit_id={data['audit_id']}")


class TestAuditLogs:
    """Audit log tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_audit_logs(self):
        """Test GET /api/audit-logs"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get audit logs: {len(data)} logs found")
    
    def test_get_audit_logs_with_limit(self):
        """Test GET /api/audit-logs?limit=10"""
        response = requests.get(f"{BASE_URL}/api/audit-logs?limit=10", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10
        print(f"✓ Get audit logs with limit: {len(data)} logs")
    
    def test_get_audit_logs_by_status(self):
        """Test GET /api/audit-logs?status=sent"""
        response = requests.get(f"{BASE_URL}/api/audit-logs?status=sent", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for log in data:
            assert log["status"] == "sent"
        print(f"✓ Get audit logs by status: {len(data)} sent logs")
    
    def test_reprocess_message(self):
        """Test POST /api/audit-logs/:auditId/reprocess"""
        # Get an existing audit log
        logs_response = requests.get(f"{BASE_URL}/api/audit-logs?limit=1", headers=self.headers)
        logs = logs_response.json()
        
        if not logs:
            pytest.skip("No audit logs available for reprocessing test")
        
        audit_id = logs[0]["id"]
        response = requests.post(
            f"{BASE_URL}/api/audit-logs/{audit_id}/reprocess",
            headers=self.headers,
            timeout=35
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "audit_id" in data
        print(f"✓ Reprocess message: status={data['status']}")
    
    def test_bulk_reprocess(self):
        """Test POST /api/audit-logs/bulk-reprocess"""
        # Get existing audit logs
        logs_response = requests.get(f"{BASE_URL}/api/audit-logs?limit=2", headers=self.headers)
        logs = logs_response.json()
        
        if len(logs) < 1:
            pytest.skip("No audit logs available for bulk reprocess test")
        
        audit_ids = [log["id"] for log in logs[:2]]
        response = requests.post(
            f"{BASE_URL}/api/audit-logs/bulk-reprocess",
            json={"audit_ids": audit_ids},
            headers=self.headers,
            timeout=70  # Allow for multiple message timeouts
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "successful" in data
        assert "failed" in data
        assert "results" in data
        print(f"✓ Bulk reprocess: total={data['total']}, successful={data['successful']}, failed={data['failed']}")


class TestScheduledMessages:
    """Scheduled message tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get existing data
        envs = requests.get(f"{BASE_URL}/api/environments", headers=self.headers).json()
        tenants = requests.get(f"{BASE_URL}/api/tenants", headers=self.headers).json()
        templates = requests.get(f"{BASE_URL}/api/templates", headers=self.headers).json()
        
        self.env_id = envs[0]["id"] if envs else None
        self.tenant_id = tenants[0]["id"] if tenants else None
        self.template_id = templates[0]["id"] if templates else None
    
    def test_get_scheduled_messages(self):
        """Test GET /api/scheduled-messages"""
        response = requests.get(f"{BASE_URL}/api/scheduled-messages", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get scheduled messages: {len(data)} messages found")
    
    def test_create_scheduled_message(self):
        """Test POST /api/scheduled-messages"""
        if not all([self.env_id, self.tenant_id, self.template_id]):
            pytest.skip("No test data available for scheduling")
        
        # Schedule for 1 hour from now
        from datetime import datetime, timedelta
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        
        schedule_data = {
            "environment_id": self.env_id,
            "tenant_id": self.tenant_id,
            "template_id": self.template_id,
            "mrn": "TEST-SCHED-MRN",
            "visit_number": "TEST-SCHED-VISIT",
            "room": "201",
            "bed": "B",
            "floor": "2",
            "scheduled_at": scheduled_time
        }
        response = requests.post(
            f"{BASE_URL}/api/scheduled-messages",
            json=schedule_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert "id" in data
        print(f"✓ Created scheduled message: id={data['id']}, scheduled_at={data['scheduled_at']}")
        
        # Cleanup - delete the scheduled message
        requests.delete(f"{BASE_URL}/api/scheduled-messages/{data['id']}", headers=self.headers)
        return data["id"]
    
    def test_delete_scheduled_message(self):
        """Test DELETE /api/scheduled-messages/:messageId"""
        if not all([self.env_id, self.tenant_id, self.template_id]):
            pytest.skip("No test data available")
        
        from datetime import datetime, timedelta
        scheduled_time = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        
        # Create a scheduled message
        create_response = requests.post(
            f"{BASE_URL}/api/scheduled-messages",
            json={
                "environment_id": self.env_id,
                "tenant_id": self.tenant_id,
                "template_id": self.template_id,
                "mrn": "TEST-DELETE-SCHED",
                "visit_number": "TEST-DELETE-VISIT",
                "room": "301",
                "bed": "C",
                "floor": "3",
                "scheduled_at": scheduled_time
            },
            headers=self.headers
        )
        message_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/scheduled-messages/{message_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted scheduled message: {message_id}")


class TestDashboardStats:
    """Dashboard statistics tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_dashboard_stats(self):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        assert "environments_count" in data
        assert "tenants_count" in data
        assert "templates_count" in data
        assert "messages_sent" in data
        assert "successful" in data
        assert "failed" in data
        assert "success_rate" in data
        
        # Verify data types
        assert isinstance(data["environments_count"], int)
        assert isinstance(data["tenants_count"], int)
        assert isinstance(data["templates_count"], int)
        assert isinstance(data["messages_sent"], int)
        
        print(f"✓ Dashboard stats: {data['environments_count']} envs, {data['tenants_count']} tenants, {data['templates_count']} templates")
        print(f"  Messages: {data['messages_sent']} total, {data['successful']} successful, {data['failed']} failed")
        print(f"  Success rate: {data['success_rate']}%")


class TestUserManagement:
    """User management tests (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_users(self):
        """Test GET /api/users (admin only)"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify admin user exists
        admin_user = next((u for u in data if u["email"] == ADMIN_EMAIL), None)
        assert admin_user is not None
        assert admin_user["role"] == "admin"
        print(f"✓ Get users: {len(data)} users found")
    
    def test_register_user(self):
        """Test POST /api/auth/register"""
        user_data = {
            "email": "test_user@msgrouter.com",
            "password": "testpass123",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        
        if response.status_code == 400:
            # User already exists
            print("✓ User registration: user already exists (expected)")
            return
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["role"] == user_data["role"]
        print(f"✓ Registered user: {data['email']}")


# Cleanup function to remove test data
def cleanup_test_data():
    """Remove all TEST_ prefixed data"""
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if login_response.status_code != 200:
        return
    
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Delete test templates
    templates = requests.get(f"{BASE_URL}/api/templates", headers=headers).json()
    for t in templates:
        if t["name"].startswith("TEST_"):
            requests.delete(f"{BASE_URL}/api/templates/{t['id']}", headers=headers)
    
    # Delete test tenants
    tenants = requests.get(f"{BASE_URL}/api/tenants", headers=headers).json()
    for t in tenants:
        if t["name"].startswith("TEST_"):
            requests.delete(f"{BASE_URL}/api/tenants/{t['id']}", headers=headers)
    
    # Delete test environments
    envs = requests.get(f"{BASE_URL}/api/environments", headers=headers).json()
    for e in envs:
        if e["name"].startswith("TEST_"):
            requests.delete(f"{BASE_URL}/api/environments/{e['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

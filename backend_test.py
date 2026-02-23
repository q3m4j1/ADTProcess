#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime
import time

class MsgRouterAPITester:
    def __init__(self, base_url="https://adt-config-tool.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_items = {
            'environments': [],
            'tenants': [],
            'templates': []
        }

    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Response: {response.text[:200]}")

            return success, response.json() if success else {}

        except Exception as e:
            self.log(f"❌ {name} - Network Error: {str(e)}", "ERROR")
            return False, {}

    def test_login(self, email="admin@msgrouter.com", password="admin123"):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user = response['user']
            self.log(f"   Logged in as: {self.user['email']} (Role: {self.user['role']})")
            return True
        return False

    def test_seed_data(self):
        """Test seeding initial data"""
        success, response = self.run_test(
            "Seed Initial Data",
            "POST", 
            "seed",
            200
        )
        if success:
            self.log(f"   Seeded {response.get('environments', 0)} environments")
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats", 
            200
        )
        if success:
            self.log(f"   Stats: {response['environments_count']} envs, {response['tenants_count']} tenants, {response['templates_count']} templates")
        return success, response

    def test_environments(self):
        """Test environment CRUD operations"""
        # Get environments
        success, envs = self.run_test(
            "Get Environments",
            "GET",
            "environments",
            200
        )
        if not success:
            return False
            
        self.log(f"   Found {len(envs)} environments")
        
        # Create environment
        test_env = {
            "name": f"Test-Env-{int(time.time())}",
            "address": "https://test.example.com:18443",
            "color": "#FF5733"
        }
        
        success, created_env = self.run_test(
            "Create Environment",
            "POST",
            "environments",
            200,
            data=test_env
        )
        
        if success:
            self.created_items['environments'].append(created_env['id'])
            self.log(f"   Created environment: {created_env['name']}")
            
            # Update environment
            update_data = {"name": f"{created_env['name']}-Updated"}
            success, updated_env = self.run_test(
                "Update Environment",
                "PUT",
                f"environments/{created_env['id']}",
                200,
                data=update_data
            )
            
            if success:
                self.log(f"   Updated environment name to: {updated_env['name']}")
        
        return success

    def test_tenants(self):
        """Test tenant CRUD operations"""
        # Get existing environments first
        success, envs = self.run_test(
            "Get Environments for Tenants",
            "GET", 
            "environments",
            200
        )
        
        if not success or not envs:
            self.log("❌ No environments available for tenant testing", "ERROR")
            return False
            
        # Use first environment
        env_id = envs[0]['id']
        
        # Create tenant
        test_tenant = {
            "name": f"Test-Tenant-{int(time.time())}",
            "environment_id": env_id,
            "port": 18443
        }
        
        success, created_tenant = self.run_test(
            "Create Tenant",
            "POST",
            "tenants",
            200,
            data=test_tenant
        )
        
        if success:
            self.created_items['tenants'].append(created_tenant['id'])
            self.log(f"   Created tenant: {created_tenant['name']} on port {created_tenant['port']}")
            
            # Get tenants
            success, tenants = self.run_test(
                "Get Tenants",
                "GET",
                "tenants",
                200
            )
            
            if success:
                self.log(f"   Total tenants: {len(tenants)}")
        
        return success

    def test_templates(self):
        """Test message template CRUD operations"""
        # Get existing tenants first
        success, tenants = self.run_test(
            "Get Tenants for Templates",
            "GET",
            "tenants", 
            200
        )
        
        if not success or not tenants:
            self.log("❌ No tenants available for template testing", "ERROR")
            return False
            
        # Use first tenant
        tenant_id = tenants[0]['id']
        
        # Create template
        test_template = {
            "name": f"Test-Template-{int(time.time())}",
            "tenant_id": tenant_id,
            "body": "MSH|^~\\&|SENDER|FAC|RECEIVER|FAC|{{TIMESTAMP}}||ADT^A01|{{MSG_ID}}|P|2.3\nEVN||{{TIMESTAMP}}\nPID|1||{{MRN}}||PATIENT^TEST||19900101|M\nPV1|1|I|{{FLOOR}}^{{ROOM}}^{{BED}}|"
        }
        
        success, created_template = self.run_test(
            "Create Message Template",
            "POST",
            "templates",
            200,
            data=test_template
        )
        
        if success:
            self.created_items['templates'].append(created_template['id'])
            self.log(f"   Created template: {created_template['name']}")
            self.log(f"   Template body length: {len(created_template['body'])} chars")
            
            # Get templates
            success, templates = self.run_test(
                "Get Templates",
                "GET", 
                "templates",
                200
            )
            
            if success:
                self.log(f"   Total templates: {len(templates)}")
        
        return success

    def test_send_message(self):
        """Test message sending functionality"""
        # Get required data
        success, envs = self.run_test("Get Environments", "GET", "environments", 200)
        if not success or not envs:
            return False
            
        success, tenants = self.run_test("Get Tenants", "GET", "tenants", 200)
        if not success or not tenants:
            return False
            
        success, templates = self.run_test("Get Templates", "GET", "templates", 200)
        if not success or not templates:
            return False
        
        # Find a valid combination
        env = envs[0]
        tenant = next((t for t in tenants if t['environment_id'] == env['id']), None)
        if not tenant:
            self.log("❌ No tenant found for first environment", "ERROR")
            return False
            
        template = next((t for t in templates if t['tenant_id'] == tenant['id']), None)
        if not template:
            self.log("❌ No template found for first tenant", "ERROR")
            return False
        
        # Send message
        message_data = {
            "environment_id": env['id'],
            "tenant_id": tenant['id'],
            "template_id": template['id'],
            "mrn": "TEST001234",
            "visit_number": "V-2026-001",
            "room": "301",
            "bed": "A",
            "floor": "3"
        }
        
        success, result = self.run_test(
            "Send Message",
            "POST",
            "messages/send",
            200,
            data=message_data
        )
        
        if success:
            self.log(f"   Message Status: {result['status']}")
            self.log(f"   Target URL: {result['target_url']}")
            if result.get('response_code'):
                self.log(f"   Response Code: {result['response_code']}")
        
        return success

    def test_audit_logs(self):
        """Test audit log retrieval"""
        success, logs = self.run_test(
            "Get Audit Logs",
            "GET",
            "audit-logs",
            200,
            params={"limit": 10}
        )
        
        if success:
            self.log(f"   Found {len(logs)} audit log entries")
            if logs:
                latest = logs[0]
                self.log(f"   Latest: {latest['user_email']} -> {latest['environment_name']}/{latest['tenant_name']} ({latest['status']})")
        
        return success

    def cleanup_created_items(self):
        """Clean up test data created during testing"""
        self.log("Cleaning up test data...")
        
        # Delete templates
        for template_id in self.created_items['templates']:
            self.run_test(f"Delete Template {template_id}", "DELETE", f"templates/{template_id}", 200)
            
        # Delete tenants
        for tenant_id in self.created_items['tenants']:
            self.run_test(f"Delete Tenant {tenant_id}", "DELETE", f"tenants/{tenant_id}", 200)
            
        # Delete environments  
        for env_id in self.created_items['environments']:
            self.run_test(f"Delete Environment {env_id}", "DELETE", f"environments/{env_id}", 200)

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        self.log("=" * 60)
        self.log("Starting MsgRouter Platform API Tests")
        self.log("=" * 60)

        try:
            # Authentication
            if not self.test_login():
                self.log("❌ Login failed, stopping tests", "ERROR")
                return 1

            # Seed data
            self.test_seed_data()
            
            # Dashboard stats
            stats_success, stats = self.test_dashboard_stats()
            if stats_success:
                expected_envs = 14  # From requirements
                if stats['environments_count'] != expected_envs:
                    self.log(f"⚠️  Expected {expected_envs} environments, found {stats['environments_count']}", "WARNING")

            # CRUD Tests
            self.test_environments()
            self.test_tenants() 
            self.test_templates()
            
            # Message sending
            self.test_send_message()
            
            # Audit logs
            self.test_audit_logs()
            
            # Cleanup
            self.cleanup_created_items()

        except Exception as e:
            self.log(f"❌ Unexpected error: {str(e)}", "ERROR")
            return 1

        # Results
        self.log("=" * 60)
        self.log(f"Tests completed: {self.tests_passed}/{self.tests_run} passed")
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests PASSED!")
            return 0
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests FAILED")
            return 1

def main():
    tester = MsgRouterAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
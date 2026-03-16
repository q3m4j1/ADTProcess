#!/usr/bin/env python3
"""
Backend API Testing for MsgRouter Platform
Testing the new bulk reprocess and message scheduling features
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta

class MsgRouterTester:
    def __init__(self, base_url="https://adt-config-tool.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json() if response.content else response.text
                    self.log(f"   Response: {error_detail}")
                except:
                    self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.RequestException as e:
            self.log(f"❌ FAILED - Network error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test login with admin credentials"""
        self.log("\n=== AUTHENTICATION TESTS ===")
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/auth/login",
            200,
            data={"email": "admin@msgrouter.com", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            self.log(f"✓ Token obtained for user {response.get('user', {}).get('email')}")
            return True
        else:
            self.log("❌ Failed to authenticate - cannot continue")
            return False

    def test_dashboard_data(self):
        """Test dashboard data endpoints"""
        self.log("\n=== DASHBOARD DATA TESTS ===")
        
        # Test dashboard stats
        self.run_test("Dashboard Stats", "GET", "/dashboard/stats", 200)
        
        # Test environments
        success, environments = self.run_test("Get Environments", "GET", "/environments", 200)
        
        # Test tenants
        success, tenants = self.run_test("Get Tenants", "GET", "/tenants", 200)
        
        # Test templates
        success, templates = self.run_test("Get Templates", "GET", "/templates", 200)
        
        # Test audit logs
        success, audit_logs = self.run_test("Get Audit Logs", "GET", "/audit-logs?limit=50", 200)
        
        return environments, tenants, templates, audit_logs

    def test_message_sending(self, environments, tenants, templates):
        """Test basic message sending to create audit logs"""
        self.log("\n=== MESSAGE SENDING TESTS ===")
        
        if not environments or not tenants or not templates:
            self.log("❌ No data available for message sending tests")
            return []
        
        # Use first available data
        env = environments[0] if environments else None
        tenant = next((t for t in tenants if t['environment_id'] == env['id']), None) if env else None
        template = next((t for t in templates if t['tenant_id'] == tenant['id']), None) if tenant else None
        
        if not (env and tenant and template):
            self.log("❌ Cannot find valid environment/tenant/template combination")
            return []
        
        self.log(f"Using Environment: {env['name']}, Tenant: {tenant['name']}, Template: {template['name']}")
        
        # Send a test message (this will likely fail due to external endpoints, but should create audit log)
        message_data = {
            "environment_id": env['id'],
            "tenant_id": tenant['id'],
            "template_id": template['id'],
            "mrn": "TEST-MRN-001",
            "visit_number": "V-2026-TEST",
            "room": "101",
            "bed": "A",
            "floor": "1"
        }
        
        success, response = self.run_test(
            "Send Test Message",
            "POST",
            "/messages/send",
            200,
            data=message_data
        )
        
        audit_id = response.get('audit_id') if success else None
        return [audit_id] if audit_id else []

    def test_bulk_reprocess(self, audit_ids):
        """Test bulk reprocess functionality"""
        self.log("\n=== BULK REPROCESS TESTS ===")
        
        if not audit_ids:
            self.log("❌ No audit IDs available for bulk reprocess tests")
            # Get some audit logs first
            success, audit_logs = self.run_test("Get Audit Logs for Reprocess", "GET", "/audit-logs?limit=5", 200)
            if success and audit_logs:
                audit_ids = [log['id'] for log in audit_logs[:2]]  # Take first 2
                self.log(f"Using existing audit IDs: {audit_ids}")
            else:
                return False
        
        # Test single reprocess first
        if audit_ids:
            self.run_test(
                "Single Message Reprocess",
                "POST",
                f"/audit-logs/{audit_ids[0]}/reprocess",
                200
            )
        
        # Test bulk reprocess
        bulk_data = {
            "audit_ids": audit_ids[:2] if len(audit_ids) >= 2 else audit_ids
        }
        
        success, response = self.run_test(
            "Bulk Reprocess Messages",
            "POST",
            "/audit-logs/bulk-reprocess",
            200,
            data=bulk_data
        )
        
        if success:
            total = response.get('total', 0)
            successful = response.get('successful', 0)
            failed = response.get('failed', 0)
            self.log(f"   Bulk reprocess results: {successful} successful, {failed} failed out of {total} total")
        
        return success

    def test_scheduled_messages(self, environments, tenants, templates):
        """Test message scheduling functionality"""
        self.log("\n=== SCHEDULED MESSAGES TESTS ===")
        
        if not environments or not tenants or not templates:
            self.log("❌ No data available for scheduling tests")
            return False
        
        # Use first available data
        env = environments[0] if environments else None
        tenant = next((t for t in tenants if t['environment_id'] == env['id']), None) if env else None
        template = next((t for t in templates if t['tenant_id'] == tenant['id']), None) if tenant else None
        
        if not (env and tenant and template):
            self.log("❌ Cannot find valid environment/tenant/template combination")
            return False
        
        # Schedule a message for 1 hour from now
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + 'Z'
        
        schedule_data = {
            "environment_id": env['id'],
            "tenant_id": tenant['id'],
            "template_id": template['id'],
            "mrn": "SCHEDULED-MRN-001",
            "visit_number": "V-2026-SCHED",
            "room": "202",
            "bed": "B",
            "floor": "2",
            "scheduled_at": scheduled_time
        }
        
        # Test creating scheduled message
        success, response = self.run_test(
            "Create Scheduled Message",
            "POST",
            "/scheduled-messages",
            200,
            data=schedule_data
        )
        
        scheduled_id = response.get('id') if success else None
        
        # Test getting scheduled messages
        success, scheduled_messages = self.run_test(
            "Get Scheduled Messages",
            "GET",
            "/scheduled-messages",
            200
        )
        
        if success:
            self.log(f"   Found {len(scheduled_messages)} scheduled message(s)")
        
        # Test canceling scheduled message
        if scheduled_id:
            success = self.run_test(
                "Cancel Scheduled Message",
                "DELETE",
                f"/scheduled-messages/{scheduled_id}",
                200
            )[0]
            
        # Test process scheduled messages endpoint
        self.run_test(
            "Process Scheduled Messages",
            "POST",
            "/scheduled-messages/process",
            200
        )
        
        return True

    def test_seed_data(self):
        """Test seed data endpoint"""
        self.log("\n=== SEED DATA TEST ===")
        self.run_test("Seed Data", "POST", "/seed", 200)

    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting MsgRouter Platform Backend API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Authentication
        if not self.test_authentication():
            return False
        
        # Seed data
        self.test_seed_data()
        
        # Dashboard data
        environments, tenants, templates, audit_logs = self.test_dashboard_data()
        
        # Message sending (to create audit logs)
        audit_ids = self.test_message_sending(environments, tenants, templates)
        
        # Bulk reprocess
        self.test_bulk_reprocess(audit_ids)
        
        # Scheduled messages
        self.test_scheduled_messages(environments, tenants, templates)
        
        # Summary
        self.log(f"\n📊 TEST SUMMARY")
        self.log(f"Tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = MsgRouterTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
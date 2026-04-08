"""
ADT Operations API Tests
Tests for: Operation Types CRUD, Patients CRUD, ADT Operations (Admission, Transfer, Discharge, Update)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@msgrouter.com"
ADMIN_PASSWORD = "admin123"

class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def test_environment(self, auth_headers):
        """Get or create a test environment"""
        # Get existing environments
        response = requests.get(f"{BASE_URL}/api/environments", headers=auth_headers)
        assert response.status_code == 200
        envs = response.json()
        
        # Find DEV environment or use first one
        dev_env = next((e for e in envs if e['name'] == 'DEV'), None)
        if dev_env:
            return dev_env
        
        # Use first available environment
        if envs:
            return envs[0]
        
        pytest.skip("No environments available for testing")
    
    @pytest.fixture(scope="class")
    def test_tenant(self, auth_headers, test_environment):
        """Get or create a test tenant"""
        response = requests.get(
            f"{BASE_URL}/api/tenants?environment_id={test_environment['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        tenants = response.json()
        
        if tenants:
            return tenants[0]
        
        pytest.skip("No tenants available for testing")


class TestOperationTypes(TestSetup):
    """Operation Types CRUD tests"""
    
    def test_get_operation_types(self, auth_headers):
        """GET /api/operation-types - Get all operation types"""
        response = requests.get(f"{BASE_URL}/api/operation-types", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} operation types")
    
    def test_seed_operation_types(self, auth_headers):
        """POST /api/seed-operation-types - Seed default operation types"""
        response = requests.post(f"{BASE_URL}/api/seed-operation-types", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Seed result: {data['message']}")
    
    def test_create_operation_type(self, auth_headers):
        """POST /api/operation-types - Create new operation type"""
        test_name = f"TEST_OpType_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": test_name,
            "category": "custom",
            "hl7_event": "ADT^A08",
            "description": "Test operation type"
        }
        
        response = requests.post(f"{BASE_URL}/api/operation-types", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["name"] == test_name
        assert data["category"] == "custom"
        assert data["hl7_event"] == "ADT^A08"
        assert "id" in data
        
        # Store for cleanup
        self.__class__.created_optype_id = data["id"]
        print(f"Created operation type: {data['id']}")
        return data
    
    def test_update_operation_type(self, auth_headers):
        """PUT /api/operation-types/:id - Update operation type"""
        if not hasattr(self.__class__, 'created_optype_id'):
            pytest.skip("No operation type created to update")
        
        optype_id = self.__class__.created_optype_id
        update_payload = {
            "description": "Updated test description"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/operation-types/{optype_id}", 
            headers=auth_headers, 
            json=update_payload
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        assert data["description"] == "Updated test description"
        print(f"Updated operation type: {optype_id}")
    
    def test_delete_operation_type(self, auth_headers):
        """DELETE /api/operation-types/:id - Delete operation type"""
        if not hasattr(self.__class__, 'created_optype_id'):
            pytest.skip("No operation type created to delete")
        
        optype_id = self.__class__.created_optype_id
        
        response = requests.delete(
            f"{BASE_URL}/api/operation-types/{optype_id}", 
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/api/operation-types", headers=auth_headers)
        data = response.json()
        assert not any(op["id"] == optype_id for op in data), "Operation type still exists after deletion"
        print(f"Deleted operation type: {optype_id}")


class TestPatients(TestSetup):
    """Patients CRUD tests"""
    
    def test_get_patients(self, auth_headers, test_tenant):
        """GET /api/patients - Get patients by tenant"""
        response = requests.get(
            f"{BASE_URL}/api/patients?tenant_id={test_tenant['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} patients for tenant {test_tenant['name']}")
    
    def test_create_patient(self, auth_headers, test_tenant, test_environment):
        """POST /api/patients - Create patient"""
        test_mrn = f"TEST_MRN_{uuid.uuid4().hex[:8]}"
        payload = {
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Test",
            "last_name": "Patient",
            "birth_date": "1990-01-15",
            "gender": "M",
            "language": "EN",
            "interpreter_needed": False,
            "tenant_id": test_tenant["id"],
            "environment_id": test_environment["id"]
        }
        
        response = requests.post(f"{BASE_URL}/api/patients", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create patient failed: {response.text}"
        
        data = response.json()
        assert data["mrn"] == test_mrn
        assert data["first_name"] == "Test"
        assert data["last_name"] == "Patient"
        assert data["status"] == "registered"
        assert "id" in data
        
        self.__class__.created_patient_id = data["id"]
        print(f"Created patient: {data['id']} with MRN: {test_mrn}")
        return data
    
    def test_update_patient(self, auth_headers):
        """PUT /api/patients/:id - Update patient"""
        if not hasattr(self.__class__, 'created_patient_id'):
            pytest.skip("No patient created to update")
        
        patient_id = self.__class__.created_patient_id
        update_payload = {
            "language": "ES",
            "interpreter_needed": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/patients/{patient_id}", 
            headers=auth_headers, 
            json=update_payload
        )
        assert response.status_code == 200, f"Update patient failed: {response.text}"
        
        data = response.json()
        assert data["language"] == "ES"
        assert data["interpreter_needed"] == True
        print(f"Updated patient: {patient_id}")


class TestADTAdmission(TestSetup):
    """ADT Admission tests"""
    
    def test_admission_creates_patient_and_sends_hl7(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/admission - Admit patient with HL7 ADT^A01"""
        test_mrn = f"TEST_ADM_{uuid.uuid4().hex[:8]}"
        payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Admission",
            "last_name": "TestPatient",
            "birth_date": "1985-06-20",
            "gender": "F",
            "language": "EN",
            "interpreter_needed": False,
            "bed": "A",
            "room": "101",
            "floor": "1"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/admission", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Admission failed: {response.text}"
        
        data = response.json()
        # Status can be 'sent' or 'failed' depending on external endpoint availability
        assert "status" in data
        assert "patient_id" in data
        assert "message" in data
        assert "target_url" in data
        assert "audit_id" in data
        
        # Verify HL7 message contains ADT^A01
        assert "ADT^A01" in data["message"]
        assert test_mrn in data["message"]
        
        self.__class__.admitted_patient_id = data["patient_id"]
        self.__class__.admitted_mrn = test_mrn
        print(f"Admission completed: patient_id={data['patient_id']}, status={data['status']}")
        
        # Verify patient was created in database
        patient_response = requests.get(
            f"{BASE_URL}/api/patients/{data['patient_id']}", 
            headers=auth_headers
        )
        assert patient_response.status_code == 200
        patient = patient_response.json()
        assert patient["status"] == "admitted"
        assert patient["current_bed"] == "A"
        assert patient["current_room"] == "101"
        print(f"Patient verified in database with status: {patient['status']}")


class TestADTTransfer(TestSetup):
    """ADT Transfer tests"""
    
    def test_transfer_patient_regular_room(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/transfer - Transfer patient to regular room with HL7 ADT^A02"""
        # First create an admitted patient
        test_mrn = f"TEST_TRF_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Transfer",
            "last_name": "TestPatient",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        assert admission_response.status_code == 200
        patient_id = admission_response.json()["patient_id"]
        
        # Now transfer the patient
        transfer_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "from_bed": "A",
            "from_room": "100",
            "from_floor": "1",
            "to_bed": "B",
            "to_room": "201",
            "to_floor": "2",
            "location_type": "room"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/transfer", headers=auth_headers, json=transfer_payload)
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "message" in data
        assert "ADT^A02" in data["message"]
        
        # Verify patient location was updated
        patient_response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        patient = patient_response.json()
        assert patient["current_bed"] == "B"
        assert patient["current_room"] == "201"
        assert patient["current_floor"] == "2"
        print(f"Transfer completed: patient moved to room 201")
    
    def test_transfer_patient_unknown_location(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/transfer - Transfer patient to unknown location"""
        # Create admitted patient
        test_mrn = f"TEST_UNK_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Unknown",
            "last_name": "Location",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Transfer to unknown location
        transfer_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "location_type": "unknown"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/transfer", headers=auth_headers, json=transfer_payload)
        assert response.status_code == 200, f"Transfer to unknown failed: {response.text}"
        
        data = response.json()
        assert "UNKNOWN" in data["message"]
        print(f"Transfer to unknown location completed")
    
    def test_transfer_patient_or_room(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/transfer - Transfer patient to OR room"""
        # Create admitted patient
        test_mrn = f"TEST_OR_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "OR",
            "last_name": "Patient",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Transfer to OR
        transfer_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "to_room": "OR1",
            "location_type": "or"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/transfer", headers=auth_headers, json=transfer_payload)
        assert response.status_code == 200, f"Transfer to OR failed: {response.text}"
        
        data = response.json()
        assert "OR" in data["message"]
        print(f"Transfer to OR completed")


class TestADTDischarge(TestSetup):
    """ADT Discharge tests"""
    
    def test_immediate_discharge(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/discharge - Immediate discharge with HL7 ADT^A03"""
        # Create admitted patient
        test_mrn = f"TEST_DIS_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Discharge",
            "last_name": "Immediate",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Immediate discharge
        discharge_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "discharge_type": "immediate"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/discharge", headers=auth_headers, json=discharge_payload)
        assert response.status_code == 200, f"Discharge failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "message" in data
        assert "ADT^A03" in data["message"]
        
        # Verify patient status changed to discharged
        patient_response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        patient = patient_response.json()
        assert patient["status"] == "discharged"
        assert patient["current_bed"] is None
        print(f"Immediate discharge completed: patient status={patient['status']}")
    
    def test_scheduled_discharge(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/discharge - Scheduled discharge"""
        # Create admitted patient
        test_mrn = f"TEST_SCH_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Discharge",
            "last_name": "Scheduled",
            "bed": "B",
            "room": "200",
            "floor": "2"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Scheduled discharge
        from datetime import datetime, timedelta
        scheduled_time = (datetime.now() + timedelta(hours=2)).isoformat()
        
        discharge_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "discharge_type": "scheduled",
            "scheduled_time": scheduled_time
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/discharge", headers=auth_headers, json=discharge_payload)
        assert response.status_code == 200, f"Scheduled discharge failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "scheduled"
        assert "scheduled_at" in data
        assert "scheduled_id" in data
        
        # Patient should still be admitted (not discharged yet)
        patient_response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        patient = patient_response.json()
        assert patient["status"] == "admitted"
        print(f"Scheduled discharge created: scheduled_id={data['scheduled_id']}")


class TestADTUpdate(TestSetup):
    """ADT Update tests (ORM, ORU, Medications, etc.)"""
    
    def test_update_with_orm_order(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/update - Update patient with ORM order"""
        # First ensure operation types are seeded
        requests.post(f"{BASE_URL}/api/seed-operation-types", headers=auth_headers)
        
        # Get ORM operation type
        op_types_response = requests.get(f"{BASE_URL}/api/operation-types", headers=auth_headers)
        op_types = op_types_response.json()
        orm_type = next((t for t in op_types if "ORM" in t.get("hl7_event", "")), None)
        
        if not orm_type:
            pytest.skip("No ORM operation type available")
        
        # Create admitted patient
        test_mrn = f"TEST_ORM_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "ORM",
            "last_name": "Patient",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Send ORM update
        update_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "operation_type_id": orm_type["id"],
            "custom_data": {
                "order_code": "CBC",
                "order_name": "Complete Blood Count"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/update", headers=auth_headers, json=update_payload)
        assert response.status_code == 200, f"ORM update failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "message" in data
        assert "ORM" in data["message"]
        assert "CBC" in data["message"]
        print(f"ORM update completed: {data['status']}")
    
    def test_update_with_oru_result(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/update - Update patient with ORU result"""
        # Get ORU operation type
        op_types_response = requests.get(f"{BASE_URL}/api/operation-types", headers=auth_headers)
        op_types = op_types_response.json()
        oru_type = next((t for t in op_types if "ORU" in t.get("hl7_event", "")), None)
        
        if not oru_type:
            pytest.skip("No ORU operation type available")
        
        # Create admitted patient
        test_mrn = f"TEST_ORU_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "ORU",
            "last_name": "Patient",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Send ORU update
        update_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "operation_type_id": oru_type["id"],
            "custom_data": {
                "test_code": "GLU",
                "test_name": "Glucose",
                "result_value": "95",
                "unit": "mg/dL",
                "abnormal_flag": "N"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/update", headers=auth_headers, json=update_payload)
        assert response.status_code == 200, f"ORU update failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "message" in data
        assert "ORU" in data["message"]
        assert "GLU" in data["message"]
        assert "95" in data["message"]
        print(f"ORU update completed: {data['status']}")
    
    def test_update_with_medication(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/update - Update patient with medication administration"""
        # Get medication operation type
        op_types_response = requests.get(f"{BASE_URL}/api/operation-types", headers=auth_headers)
        op_types = op_types_response.json()
        med_type = next((t for t in op_types if t.get("category") == "medications"), None)
        
        if not med_type:
            pytest.skip("No medication operation type available")
        
        # Create admitted patient
        test_mrn = f"TEST_MED_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Medication",
            "last_name": "Patient",
            "bed": "A",
            "room": "100",
            "floor": "1"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Send medication update
        update_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "operation_type_id": med_type["id"],
            "custom_data": {
                "medication_code": "ASA",
                "medication_name": "Aspirin",
                "dose": "325",
                "route": "PO"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/update", headers=auth_headers, json=update_payload)
        assert response.status_code == 200, f"Medication update failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert "message" in data
        print(f"Medication update completed: {data['status']}")


class TestErrorHandling(TestSetup):
    """Error handling tests"""
    
    def test_admission_invalid_environment(self, auth_headers, test_tenant):
        """POST /api/adt/admission - Should fail with invalid environment"""
        payload = {
            "environment_id": "invalid-env-id",
            "tenant_id": test_tenant["id"],
            "mrn": "TEST123",
            "csn": "CSN123",
            "first_name": "Test",
            "last_name": "Patient"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/admission", headers=auth_headers, json=payload)
        assert response.status_code == 404
        assert "Environment not found" in response.json().get("detail", "")
    
    def test_admission_invalid_tenant(self, auth_headers, test_environment):
        """POST /api/adt/admission - Should fail with invalid tenant"""
        payload = {
            "environment_id": test_environment["id"],
            "tenant_id": "invalid-tenant-id",
            "mrn": "TEST123",
            "csn": "CSN123",
            "first_name": "Test",
            "last_name": "Patient"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/admission", headers=auth_headers, json=payload)
        assert response.status_code == 404
        assert "Tenant not found" in response.json().get("detail", "")
    
    def test_transfer_patient_not_found(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/transfer - Should fail with invalid patient"""
        payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": "invalid-patient-id",
            "to_room": "200"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/transfer", headers=auth_headers, json=payload)
        assert response.status_code == 404
        assert "Patient not found" in response.json().get("detail", "")
    
    def test_update_invalid_operation_type(self, auth_headers, test_tenant, test_environment):
        """POST /api/adt/update - Should fail with invalid operation type"""
        # Create a patient first
        test_mrn = f"TEST_ERR_{uuid.uuid4().hex[:8]}"
        admission_payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "mrn": test_mrn,
            "csn": f"CSN_{uuid.uuid4().hex[:6]}",
            "first_name": "Error",
            "last_name": "Test"
        }
        
        admission_response = requests.post(
            f"{BASE_URL}/api/adt/admission", 
            headers=auth_headers, 
            json=admission_payload
        )
        patient_id = admission_response.json()["patient_id"]
        
        # Try update with invalid operation type
        payload = {
            "environment_id": test_environment["id"],
            "tenant_id": test_tenant["id"],
            "patient_id": patient_id,
            "operation_type_id": "invalid-optype-id"
        }
        
        response = requests.post(f"{BASE_URL}/api/adt/update", headers=auth_headers, json=payload)
        assert response.status_code == 404
        assert "Operation type not found" in response.json().get("detail", "")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_patients(self):
        """Clean up TEST_ prefixed patients"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Cannot login for cleanup")
        
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all patients
        patients_response = requests.get(f"{BASE_URL}/api/patients", headers=headers)
        if patients_response.status_code == 200:
            patients = patients_response.json()
            test_patients = [p for p in patients if p.get("mrn", "").startswith("TEST_")]
            print(f"Found {len(test_patients)} test patients to clean up")
            # Note: No delete endpoint for patients, so we just report
        
        # Clean up test operation types
        op_types_response = requests.get(f"{BASE_URL}/api/operation-types", headers=headers)
        if op_types_response.status_code == 200:
            op_types = op_types_response.json()
            test_types = [t for t in op_types if t.get("name", "").startswith("TEST_")]
            for t in test_types:
                requests.delete(f"{BASE_URL}/api/operation-types/{t['id']}", headers=headers)
            print(f"Cleaned up {len(test_types)} test operation types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

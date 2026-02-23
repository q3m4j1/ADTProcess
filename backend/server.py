from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'msgrouter-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="MsgRouter Platform API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"  # admin or user

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    password: Optional[str] = None

class EnvironmentCreate(BaseModel):
    name: str
    address: str
    color: str = "#2563EB"

class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    color: Optional[str] = None

class EnvironmentResponse(BaseModel):
    id: str
    name: str
    address: str
    color: str
    created_at: str

class TenantCreate(BaseModel):
    name: str
    environment_id: str
    port: int

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    environment_id: Optional[str] = None
    port: Optional[int] = None

class TenantResponse(BaseModel):
    id: str
    name: str
    environment_id: str
    port: int
    created_at: str

class MessageTemplateCreate(BaseModel):
    name: str
    tenant_id: str
    body: str

class MessageTemplateUpdate(BaseModel):
    name: Optional[str] = None
    tenant_id: Optional[str] = None
    body: Optional[str] = None

class MessageTemplateResponse(BaseModel):
    id: str
    name: str
    tenant_id: str
    body: str
    created_at: str

class SendMessageRequest(BaseModel):
    environment_id: str
    tenant_id: str
    template_id: str
    mrn: str
    visit_number: str
    room: str
    bed: str
    floor: str
    edited_message: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    environment_name: str
    tenant_name: str
    template_name: str
    mrn: str
    visit_number: str
    status: str
    message_sent: str
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    created_at: str

class DashboardStats(BaseModel):
    environments_count: int
    tenants_count: int
    templates_count: int
    messages_sent: int
    successful: int
    failed: int
    success_rate: float

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user.email,
        "password_hash": hash_password(user.password),
        "role": user.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return UserResponse(
        id=user_doc["id"],
        email=user_doc["email"],
        role=user_doc["role"],
        created_at=user_doc["created_at"]
    )

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user["id"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )

# ==================== USER MANAGEMENT (Admin Only) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return UserResponse(**user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ==================== ENVIRONMENT ROUTES ====================

@api_router.get("/environments", response_model=List[EnvironmentResponse])
async def get_environments(current_user: dict = Depends(get_current_user)):
    envs = await db.environments.find({}, {"_id": 0}).to_list(1000)
    return [EnvironmentResponse(**e) for e in envs]

@api_router.post("/environments", response_model=EnvironmentResponse)
async def create_environment(env: EnvironmentCreate, current_user: dict = Depends(require_admin)):
    env_doc = {
        "id": str(uuid.uuid4()),
        "name": env.name,
        "address": env.address,
        "color": env.color,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.environments.insert_one(env_doc)
    return EnvironmentResponse(**{k: v for k, v in env_doc.items() if k != "_id"})

@api_router.put("/environments/{env_id}", response_model=EnvironmentResponse)
async def update_environment(env_id: str, update: EnvironmentUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.environments.update_one({"id": env_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    env = await db.environments.find_one({"id": env_id}, {"_id": 0})
    return EnvironmentResponse(**env)

@api_router.delete("/environments/{env_id}")
async def delete_environment(env_id: str, current_user: dict = Depends(require_admin)):
    # Check if there are tenants using this environment
    tenant_count = await db.tenants.count_documents({"environment_id": env_id})
    if tenant_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {tenant_count} tenants use this environment")
    
    result = await db.environments.delete_one({"id": env_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"message": "Environment deleted"}

# ==================== TENANT ROUTES ====================

@api_router.get("/tenants", response_model=List[TenantResponse])
async def get_tenants(environment_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"environment_id": environment_id} if environment_id else {}
    tenants = await db.tenants.find(query, {"_id": 0}).to_list(1000)
    return [TenantResponse(**t) for t in tenants]

@api_router.post("/tenants", response_model=TenantResponse)
async def create_tenant(tenant: TenantCreate, current_user: dict = Depends(require_admin)):
    # Verify environment exists
    env = await db.environments.find_one({"id": tenant.environment_id})
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    tenant_doc = {
        "id": str(uuid.uuid4()),
        "name": tenant.name,
        "environment_id": tenant.environment_id,
        "port": tenant.port,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tenants.insert_one(tenant_doc)
    return TenantResponse(**{k: v for k, v in tenant_doc.items() if k != "_id"})

@api_router.put("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: str, update: TenantUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    if "environment_id" in update_data:
        env = await db.environments.find_one({"id": update_data["environment_id"]})
        if not env:
            raise HTTPException(status_code=404, detail="Environment not found")
    
    result = await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    return TenantResponse(**tenant)

@api_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, current_user: dict = Depends(require_admin)):
    # Check if there are templates using this tenant
    template_count = await db.message_templates.count_documents({"tenant_id": tenant_id})
    if template_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {template_count} templates use this tenant")
    
    result = await db.tenants.delete_one({"id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"message": "Tenant deleted"}

# ==================== MESSAGE TEMPLATE ROUTES ====================

@api_router.get("/templates", response_model=List[MessageTemplateResponse])
async def get_templates(tenant_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"tenant_id": tenant_id} if tenant_id else {}
    templates = await db.message_templates.find(query, {"_id": 0}).to_list(1000)
    return [MessageTemplateResponse(**t) for t in templates]

@api_router.post("/templates", response_model=MessageTemplateResponse)
async def create_template(template: MessageTemplateCreate, current_user: dict = Depends(require_admin)):
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": template.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    template_doc = {
        "id": str(uuid.uuid4()),
        "name": template.name,
        "tenant_id": template.tenant_id,
        "body": template.body,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.message_templates.insert_one(template_doc)
    return MessageTemplateResponse(**{k: v for k, v in template_doc.items() if k != "_id"})

@api_router.put("/templates/{template_id}", response_model=MessageTemplateResponse)
async def update_template(template_id: str, update: MessageTemplateUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    if "tenant_id" in update_data:
        tenant = await db.tenants.find_one({"id": update_data["tenant_id"]})
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
    
    result = await db.message_templates.update_one({"id": template_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = await db.message_templates.find_one({"id": template_id}, {"_id": 0})
    return MessageTemplateResponse(**template)

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(require_admin)):
    result = await db.message_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ==================== MESSAGE SENDING ====================

@api_router.post("/messages/send")
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    # Get environment, tenant, and template
    environment = await db.environments.find_one({"id": request.environment_id}, {"_id": 0})
    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    tenant = await db.tenants.find_one({"id": request.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    template = await db.message_templates.find_one({"id": request.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build the message - use edited message if provided
    if request.edited_message:
        final_message = request.edited_message
    else:
        # Replace placeholders in template
        final_message = template["body"]
        final_message = final_message.replace("{{MRN}}", request.mrn)
        final_message = final_message.replace("{{VISIT_NUMBER}}", request.visit_number)
        final_message = final_message.replace("{{ROOM}}", request.room)
        final_message = final_message.replace("{{BED}}", request.bed)
        final_message = final_message.replace("{{FLOOR}}", request.floor)
        final_message = final_message.replace("{{TIMESTAMP}}", datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"))
        final_message = final_message.replace("{{MSG_ID}}", str(uuid.uuid4())[:8].upper())
    
    # Build the target URL using environment address and tenant port
    base_address = environment["address"].rstrip("/")
    # Extract host from address (remove port if present)
    if "://" in base_address:
        protocol, rest = base_address.split("://", 1)
        host = rest.split(":")[0] if ":" in rest else rest.split("/")[0]
        target_url = f"{protocol}://{host}:{tenant['port']}"
    else:
        target_url = f"https://{base_address}:{tenant['port']}"
    
    # Initialize audit log
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "user_email": current_user["email"],
        "environment_name": environment["name"],
        "tenant_name": tenant["name"],
        "template_name": template["name"],
        "mrn": request.mrn,
        "visit_number": request.visit_number,
        "message_sent": final_message,
        "target_url": target_url,
        "status": "pending",
        "response_code": None,
        "response_body": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Attempt to send the message via HTTP
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as http_client:
            response = await http_client.post(
                target_url,
                content=final_message,
                headers={"Content-Type": "text/plain"}
            )
            audit_log["status"] = "sent" if response.status_code < 400 else "failed"
            audit_log["response_code"] = response.status_code
            audit_log["response_body"] = response.text[:500] if response.text else None
    except httpx.TimeoutException:
        audit_log["status"] = "failed"
        audit_log["response_body"] = "Connection timeout"
    except httpx.ConnectError as e:
        audit_log["status"] = "failed"
        audit_log["response_body"] = f"Connection error: {str(e)[:200]}"
    except Exception as e:
        audit_log["status"] = "failed"
        audit_log["response_body"] = f"Error: {str(e)[:200]}"
    
    # Save audit log
    await db.audit_logs.insert_one(audit_log)
    
    return {
        "status": audit_log["status"],
        "message": final_message,
        "target_url": target_url,
        "response_code": audit_log["response_code"],
        "response_body": audit_log["response_body"],
        "audit_id": audit_log["id"]
    }

# ==================== AUDIT LOGS ====================

@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = 50,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [AuditLogResponse(**log) for log in logs]

@api_router.post("/audit-logs/{audit_id}/reprocess")
async def reprocess_message(audit_id: str, current_user: dict = Depends(get_current_user)):
    """Reprocess/retry a previously sent message"""
    
    # Get the original audit log
    original_log = await db.audit_logs.find_one({"id": audit_id}, {"_id": 0})
    if not original_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    # Get target URL from original log
    target_url = original_log.get("target_url")
    if not target_url:
        raise HTTPException(status_code=400, detail="Original message has no target URL")
    
    # Get the original message
    original_message = original_log.get("message_sent")
    if not original_message:
        raise HTTPException(status_code=400, detail="Original message content not found")
    
    # Update timestamps and message ID in the message
    final_message = original_message
    # Replace old timestamp with new one if present
    import re
    timestamp_pattern = r'\d{14}'
    new_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    final_message = re.sub(timestamp_pattern, new_timestamp, final_message, count=1)
    
    # Create new audit log for the reprocess
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "user_email": current_user["email"],
        "environment_name": original_log["environment_name"],
        "tenant_name": original_log["tenant_name"],
        "template_name": original_log["template_name"],
        "mrn": original_log["mrn"],
        "visit_number": original_log["visit_number"],
        "message_sent": final_message,
        "target_url": target_url,
        "status": "pending",
        "response_code": None,
        "response_body": None,
        "original_audit_id": audit_id,  # Reference to original message
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Attempt to send the message via HTTP
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as http_client:
            response = await http_client.post(
                target_url,
                content=final_message,
                headers={"Content-Type": "text/plain"}
            )
            audit_log["status"] = "sent" if response.status_code < 400 else "failed"
            audit_log["response_code"] = response.status_code
            audit_log["response_body"] = response.text[:500] if response.text else None
    except httpx.TimeoutException:
        audit_log["status"] = "failed"
        audit_log["response_body"] = "Connection timeout"
    except httpx.ConnectError as e:
        audit_log["status"] = "failed"
        audit_log["response_body"] = f"Connection error: {str(e)[:200]}"
    except Exception as e:
        audit_log["status"] = "failed"
        audit_log["response_body"] = f"Error: {str(e)[:200]}"
    
    # Save new audit log
    await db.audit_logs.insert_one(audit_log)
    
    return {
        "status": audit_log["status"],
        "message": final_message,
        "target_url": target_url,
        "response_code": audit_log["response_code"],
        "response_body": audit_log["response_body"],
        "audit_id": audit_log["id"],
        "original_audit_id": audit_id
    }

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    env_count = await db.environments.count_documents({})
    tenant_count = await db.tenants.count_documents({})
    template_count = await db.message_templates.count_documents({})
    total_messages = await db.audit_logs.count_documents({})
    successful = await db.audit_logs.count_documents({"status": "sent"})
    failed = await db.audit_logs.count_documents({"status": "failed"})
    
    success_rate = (successful / total_messages * 100) if total_messages > 0 else 100.0
    
    return DashboardStats(
        environments_count=env_count,
        tenants_count=tenant_count,
        templates_count=template_count,
        messages_sent=total_messages,
        successful=successful,
        failed=failed,
        success_rate=round(success_rate, 1)
    )

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for environments"""
    
    # Check if already seeded
    existing = await db.environments.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded", "environments": existing}
    
    # Default environments from requirements
    default_environments = [
        {"name": "DEV", "address": "https://4.175.139.29:18443", "color": "#2563EB"},
        {"name": "QA-EUS", "address": "https://20.15.35.115:28443", "color": "#10B981"},
        {"name": "QC", "address": "https://98.64.161.224:18443", "color": "#F59E0B"},
        {"name": "UAT", "address": "https://132.196.155.76:18443", "color": "#6366F1"},
        {"name": "Weekly", "address": "https://52.185.25.146:18443", "color": "#F97316"},
        {"name": "Nightly", "address": "https://52.238.254.228:18443", "color": "#8B5CF6"},
        {"name": "Beta", "address": "https://64.236.63.100:18443", "color": "#EC4899"},
        {"name": "Smoke", "address": "https://172.169.195.36:18443", "color": "#06B6D4"},
        {"name": "LT/BP Instance 1", "address": "https://64.236.107.150:18443", "color": "#84CC16"},
        {"name": "LT/BP Instance 2", "address": "https://64.236.107.150:18444", "color": "#22C55E"},
        {"name": "Preprod-HA Instance 1", "address": "https://20.37.140.72:18443", "color": "#3B82F6"},
        {"name": "Prod UAE", "address": "https://20.174.61.216:18443", "color": "#EF4444"},
        {"name": "Prod Instance 1", "address": "https://52.230.219.206:28443", "color": "#DC2626"},
        {"name": "Prod Instance 2", "address": "https://52.230.219.206:28444", "color": "#B91C1C"},
    ]
    
    created_envs = []
    for env_data in default_environments:
        env_doc = {
            "id": str(uuid.uuid4()),
            "name": env_data["name"],
            "address": env_data["address"],
            "color": env_data["color"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.environments.insert_one(env_doc)
        created_envs.append(env_doc["id"])
    
    # Create default admin user if not exists
    admin_exists = await db.users.find_one({"email": "admin@msgrouter.com"})
    if not admin_exists:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "admin@msgrouter.com",
            "password_hash": hash_password("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
    
    return {"message": "Seed data created", "environments": len(created_envs)}

@api_router.get("/")
async def root():
    return {"message": "MsgRouter Platform API"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

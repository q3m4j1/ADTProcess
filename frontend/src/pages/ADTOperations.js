import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  UserPlus,
  RefreshCw,
  ArrowRightLeft,
  LogOut,
  Building2,
  User,
  Bed,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
  Clock,
  Search,
  Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OPERATIONS = [
  { id: 'admission', label: 'Admission', icon: UserPlus, color: 'bg-emerald-500', description: 'Admit a new patient' },
  { id: 'update', label: 'Update', icon: RefreshCw, color: 'bg-blue-500', description: 'Update patient data (ORM, ORU, Medications, etc.)' },
  { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft, color: 'bg-amber-500', description: 'Transfer patient to another location' },
  { id: 'discharge', label: 'Discharge', icon: LogOut, color: 'bg-red-500', description: 'Discharge patient' },
];

const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
  { value: 'U', label: 'Unknown' },
];

const LANGUAGES = [
  { value: 'EN', label: 'English' },
  { value: 'ES', label: 'Spanish' },
  { value: 'FR', label: 'French' },
  { value: 'DE', label: 'German' },
  { value: 'SQ', label: 'Albanian' },
  { value: 'AR', label: 'Arabic' },
  { value: 'ZH', label: 'Chinese' },
  { value: 'OTHER', label: 'Other' },
];

const LOCATION_TYPES = [
  { value: 'room', label: 'Regular Room' },
  { value: 'or', label: 'Operating Room (OR)' },
  { value: 'unknown', label: 'Unknown Location' },
];

export default function ADTOperations() {
  const [step, setStep] = useState(1);
  const [environments, setEnvironments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selection state
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedOperationType, setSelectedOperationType] = useState(null);
  
  // Form data
  const [patientForm, setPatientForm] = useState({
    mrn: '',
    csn: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    language: 'EN',
    interpreter_needed: false,
    bed: '',
    room: '',
    floor: '',
  });
  
  const [transferForm, setTransferForm] = useState({
    from_bed: '',
    from_room: '',
    from_floor: '',
    to_bed: '',
    to_room: '',
    to_floor: '',
    location_type: 'room',
  });
  
  const [dischargeForm, setDischargeForm] = useState({
    discharge_type: 'immediate',
    scheduled_time: '',
  });
  
  const [updateForm, setUpdateForm] = useState({
    order_code: '',
    order_name: '',
    test_code: '',
    test_name: '',
    result_value: '',
    unit: '',
    abnormal_flag: 'N',
    medication_code: '',
    medication_name: '',
    dose: '',
    route: '',
  });
  
  // Result dialog
  const [resultDialog, setResultDialog] = useState({ open: false, data: null });
  
  // Patient search
  const [patientSearch, setPatientSearch] = useState('');

  useEffect(() => {
    fetchEnvironments();
  }, []);

  useEffect(() => {
    if (selectedEnv) {
      fetchTenants(selectedEnv);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedTenant) {
      fetchPatients(selectedTenant);
      fetchOperationTypes();
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (selectedPatient && selectedOperation === 'transfer') {
      setTransferForm(prev => ({
        ...prev,
        from_bed: selectedPatient.current_bed || '',
        from_room: selectedPatient.current_room || '',
        from_floor: selectedPatient.current_floor || '',
      }));
    }
  }, [selectedPatient, selectedOperation]);

  const fetchEnvironments = async () => {
    try {
      const res = await axios.get(`${API}/environments`);
      setEnvironments(res.data);
    } catch (error) {
      toast.error('Failed to load environments');
    }
  };

  const fetchTenants = async (envId) => {
    try {
      const res = await axios.get(`${API}/tenants?environment_id=${envId}`);
      setTenants(res.data);
    } catch (error) {
      toast.error('Failed to load tenants');
    }
  };

  const fetchPatients = async (tenantId) => {
    try {
      const res = await axios.get(`${API}/patients?tenant_id=${tenantId}&status=admitted`);
      setPatients(res.data);
    } catch (error) {
      console.error('Failed to load patients');
    }
  };

  const fetchOperationTypes = async () => {
    try {
      const res = await axios.get(`${API}/operation-types`);
      setOperationTypes(res.data);
      
      // Seed if empty
      if (res.data.length === 0) {
        await axios.post(`${API}/seed-operation-types`);
        const res2 = await axios.get(`${API}/operation-types`);
        setOperationTypes(res2.data);
      }
    } catch (error) {
      console.error('Failed to load operation types');
    }
  };

  const getEnvById = (id) => environments.find(e => e.id === id);
  const getTenantById = (id) => tenants.find(t => t.id === id);

  const filteredPatients = patients.filter(p => 
    !patientSearch || 
    p.mrn?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.first_name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.last_name?.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const handleEnvSelect = (envId) => {
    setSelectedEnv(envId);
    setSelectedTenant(null);
    setSelectedOperation(null);
    setSelectedPatient(null);
    setStep(1);
  };

  const handleTenantSelect = (tenantId) => {
    setSelectedTenant(tenantId);
    setSelectedOperation(null);
    setSelectedPatient(null);
    setStep(2);
  };

  const handleOperationSelect = (opId) => {
    setSelectedOperation(opId);
    setSelectedPatient(null);
    setSelectedOperationType(null);
    setStep(3);
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
  };

  const resetForm = () => {
    setPatientForm({
      mrn: '',
      csn: '',
      first_name: '',
      last_name: '',
      birth_date: '',
      gender: '',
      language: 'EN',
      interpreter_needed: false,
      bed: '',
      room: '',
      floor: '',
    });
    setTransferForm({
      from_bed: '',
      from_room: '',
      from_floor: '',
      to_bed: '',
      to_room: '',
      to_floor: '',
      location_type: 'room',
    });
    setDischargeForm({
      discharge_type: 'immediate',
      scheduled_time: '',
    });
    setUpdateForm({
      order_code: '',
      order_name: '',
      test_code: '',
      test_name: '',
      result_value: '',
      unit: '',
      abnormal_flag: 'N',
      medication_code: '',
      medication_name: '',
      dose: '',
      route: '',
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let response;
      
      if (selectedOperation === 'admission') {
        response = await axios.post(`${API}/adt/admission`, {
          environment_id: selectedEnv,
          tenant_id: selectedTenant,
          ...patientForm,
        });
      } else if (selectedOperation === 'transfer') {
        response = await axios.post(`${API}/adt/transfer`, {
          environment_id: selectedEnv,
          tenant_id: selectedTenant,
          patient_id: selectedPatient?.id,
          mrn: selectedPatient?.mrn,
          ...transferForm,
        });
      } else if (selectedOperation === 'discharge') {
        response = await axios.post(`${API}/adt/discharge`, {
          environment_id: selectedEnv,
          tenant_id: selectedTenant,
          patient_id: selectedPatient?.id,
          mrn: selectedPatient?.mrn,
          ...dischargeForm,
        });
      } else if (selectedOperation === 'update') {
        response = await axios.post(`${API}/adt/update`, {
          environment_id: selectedEnv,
          tenant_id: selectedTenant,
          patient_id: selectedPatient?.id,
          mrn: selectedPatient?.mrn,
          operation_type_id: selectedOperationType,
          custom_data: updateForm,
        });
      }
      
      setResultDialog({ open: true, data: response.data });
      
      if (response.data.status === 'sent' || response.data.status === 'scheduled') {
        toast.success(`${selectedOperation} operation completed!`);
        resetForm();
        fetchPatients(selectedTenant);
      } else {
        toast.error('Operation failed - message not delivered');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (!selectedEnv || !selectedTenant || !selectedOperation) return false;
    
    if (selectedOperation === 'admission') {
      return patientForm.mrn && patientForm.csn && patientForm.first_name && patientForm.last_name;
    }
    if (selectedOperation === 'transfer') {
      return selectedPatient && transferForm.to_room;
    }
    if (selectedOperation === 'discharge') {
      return selectedPatient && (dischargeForm.discharge_type === 'immediate' || dischargeForm.scheduled_time);
    }
    if (selectedOperation === 'update') {
      return selectedPatient && selectedOperationType;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ADT Operations</h1>
          <p className="text-slate-500">Manage patient admissions, transfers, updates, and discharges</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 p-4 bg-white rounded-xl border border-slate-200">
        <StepIndicator step={1} current={step} label="Environment" done={!!selectedEnv} />
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <StepIndicator step={2} current={step} label="Tenant" done={!!selectedTenant} />
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <StepIndicator step={3} current={step} label="Operation" done={!!selectedOperation} />
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <StepIndicator step={4} current={step} label="Details" done={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Environment Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Select Environment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {environments.map((env) => (
                <button
                  key={env.id}
                  onClick={() => handleEnvSelect(env.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    selectedEnv === env.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  data-testid={`env-select-${env.id}`}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color }} />
                  <span className="font-medium text-slate-900">{env.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Tenant Selection */}
          {selectedEnv && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Select Company/Tenant
                </CardTitle>
                <CardDescription>Active ADT tenants in {getEnvById(selectedEnv)?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {tenants.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No tenants in this environment</p>
                ) : (
                  tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSelect(tenant.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedTenant === tenant.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      data-testid={`tenant-select-${tenant.id}`}
                    >
                      <span className="font-medium text-slate-900">{tenant.name}</span>
                      <Badge variant="outline" className="text-xs">Port: {tenant.port}</Badge>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Operation Selection */}
          {selectedTenant && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Select Operation</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {OPERATIONS.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => handleOperationSelect(op.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                      selectedOperation === op.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    data-testid={`op-select-${op.id}`}
                  >
                    <div className={`w-10 h-10 ${op.color} rounded-lg flex items-center justify-center`}>
                      <op.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{op.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Form */}
        <div className="lg:col-span-2">
          {!selectedOperation ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select an Operation</h3>
                <p className="text-slate-500 max-w-sm">
                  Choose an environment, tenant, and operation type to begin managing patients
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {OPERATIONS.find(o => o.id === selectedOperation)?.icon && (
                    <div className={`w-8 h-8 ${OPERATIONS.find(o => o.id === selectedOperation)?.color} rounded-lg flex items-center justify-center`}>
                      {(() => {
                        const Icon = OPERATIONS.find(o => o.id === selectedOperation)?.icon;
                        return <Icon className="w-4 h-4 text-white" />;
                      })()}
                    </div>
                  )}
                  {OPERATIONS.find(o => o.id === selectedOperation)?.label}
                </CardTitle>
                <CardDescription>
                  {OPERATIONS.find(o => o.id === selectedOperation)?.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Admission Form */}
                {selectedOperation === 'admission' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>MRN *</Label>
                        <Input
                          value={patientForm.mrn}
                          onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })}
                          placeholder="Medical Record Number"
                          data-testid="admission-mrn"
                        />
                      </div>
                      <div>
                        <Label>CSN (Visit Number) *</Label>
                        <Input
                          value={patientForm.csn}
                          onChange={(e) => setPatientForm({ ...patientForm, csn: e.target.value })}
                          placeholder="Contact Serial Number"
                          data-testid="admission-csn"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-slate-900 mb-4">Patient Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                          <Input
                            value={patientForm.first_name}
                            onChange={(e) => setPatientForm({ ...patientForm, first_name: e.target.value })}
                            placeholder="John"
                            data-testid="admission-firstname"
                          />
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                          <Input
                            value={patientForm.last_name}
                            onChange={(e) => setPatientForm({ ...patientForm, last_name: e.target.value })}
                            placeholder="Doe"
                            data-testid="admission-lastname"
                          />
                        </div>
                        <div>
                          <Label>Date of Birth</Label>
                          <Input
                            type="date"
                            value={patientForm.birth_date}
                            onChange={(e) => setPatientForm({ ...patientForm, birth_date: e.target.value })}
                            data-testid="admission-dob"
                          />
                        </div>
                        <div>
                          <Label>Gender</Label>
                          <Select
                            value={patientForm.gender}
                            onValueChange={(v) => setPatientForm({ ...patientForm, gender: v })}
                          >
                            <SelectTrigger data-testid="admission-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Language</Label>
                          <Select
                            value={patientForm.language}
                            onValueChange={(v) => setPatientForm({ ...patientForm, language: v })}
                          >
                            <SelectTrigger data-testid="admission-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map((l) => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox
                            id="interpreter"
                            checked={patientForm.interpreter_needed}
                            onCheckedChange={(c) => setPatientForm({ ...patientForm, interpreter_needed: c })}
                            data-testid="admission-interpreter"
                          />
                          <Label htmlFor="interpreter" className="cursor-pointer">Interpreter Needed</Label>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-slate-900 mb-4">Bed Definition</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Floor</Label>
                          <Input
                            value={patientForm.floor}
                            onChange={(e) => setPatientForm({ ...patientForm, floor: e.target.value })}
                            placeholder="e.g., 3"
                            data-testid="admission-floor"
                          />
                        </div>
                        <div>
                          <Label>Room</Label>
                          <Input
                            value={patientForm.room}
                            onChange={(e) => setPatientForm({ ...patientForm, room: e.target.value })}
                            placeholder="e.g., 301"
                            data-testid="admission-room"
                          />
                        </div>
                        <div>
                          <Label>Bed</Label>
                          <Input
                            value={patientForm.bed}
                            onChange={(e) => setPatientForm({ ...patientForm, bed: e.target.value })}
                            placeholder="e.g., A"
                            data-testid="admission-bed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Update Form */}
                {selectedOperation === 'update' && (
                  <div className="space-y-6">
                    {/* Patient Selection */}
                    <div>
                      <Label>Select Patient *</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search by MRN or name..."
                          className="pl-9"
                          data-testid="patient-search"
                        />
                      </div>
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                        {filteredPatients.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">No admitted patients found</p>
                        ) : (
                          filteredPatients.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handlePatientSelect(p)}
                              className={`w-full flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-slate-50 ${
                                selectedPatient?.id === p.id ? 'bg-blue-50' : ''
                              }`}
                              data-testid={`patient-${p.id}`}
                            >
                              <div>
                                <p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p>
                                <p className="text-xs text-slate-500">MRN: {p.mrn} | CSN: {p.csn}</p>
                              </div>
                              <Badge variant="outline">{p.current_room || 'N/A'}</Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Operation Type Selection */}
                    {selectedPatient && (
                      <div>
                        <Label>Update Type *</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {operationTypes.map((type) => (
                            <button
                              key={type.id}
                              onClick={() => setSelectedOperationType(type.id)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                selectedOperationType === type.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                              data-testid={`optype-${type.id}`}
                            >
                              <p className="font-medium text-slate-900">{type.name}</p>
                              <p className="text-xs text-slate-500">{type.hl7_event}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Fields based on operation type */}
                    {selectedOperationType && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-slate-900 mb-4">Additional Details</h4>
                        {(() => {
                          const opType = operationTypes.find(t => t.id === selectedOperationType);
                          if (opType?.hl7_event?.startsWith('ORM')) {
                            return (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Order Code</Label>
                                  <Input
                                    value={updateForm.order_code}
                                    onChange={(e) => setUpdateForm({ ...updateForm, order_code: e.target.value })}
                                    placeholder="e.g., CBC"
                                    data-testid="update-order-code"
                                  />
                                </div>
                                <div>
                                  <Label>Order Name</Label>
                                  <Input
                                    value={updateForm.order_name}
                                    onChange={(e) => setUpdateForm({ ...updateForm, order_name: e.target.value })}
                                    placeholder="e.g., Complete Blood Count"
                                    data-testid="update-order-name"
                                  />
                                </div>
                              </div>
                            );
                          }
                          if (opType?.hl7_event?.startsWith('ORU')) {
                            return (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Test Code</Label>
                                  <Input
                                    value={updateForm.test_code}
                                    onChange={(e) => setUpdateForm({ ...updateForm, test_code: e.target.value })}
                                    placeholder="e.g., GLU"
                                    data-testid="update-test-code"
                                  />
                                </div>
                                <div>
                                  <Label>Test Name</Label>
                                  <Input
                                    value={updateForm.test_name}
                                    onChange={(e) => setUpdateForm({ ...updateForm, test_name: e.target.value })}
                                    placeholder="e.g., Glucose"
                                    data-testid="update-test-name"
                                  />
                                </div>
                                <div>
                                  <Label>Result Value</Label>
                                  <Input
                                    value={updateForm.result_value}
                                    onChange={(e) => setUpdateForm({ ...updateForm, result_value: e.target.value })}
                                    placeholder="e.g., 95"
                                    data-testid="update-result-value"
                                  />
                                </div>
                                <div>
                                  <Label>Unit</Label>
                                  <Input
                                    value={updateForm.unit}
                                    onChange={(e) => setUpdateForm({ ...updateForm, unit: e.target.value })}
                                    placeholder="e.g., mg/dL"
                                    data-testid="update-unit"
                                  />
                                </div>
                              </div>
                            );
                          }
                          if (opType?.category === 'medications') {
                            return (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Medication Code</Label>
                                  <Input
                                    value={updateForm.medication_code}
                                    onChange={(e) => setUpdateForm({ ...updateForm, medication_code: e.target.value })}
                                    placeholder="e.g., ASA"
                                    data-testid="update-med-code"
                                  />
                                </div>
                                <div>
                                  <Label>Medication Name</Label>
                                  <Input
                                    value={updateForm.medication_name}
                                    onChange={(e) => setUpdateForm({ ...updateForm, medication_name: e.target.value })}
                                    placeholder="e.g., Aspirin"
                                    data-testid="update-med-name"
                                  />
                                </div>
                                <div>
                                  <Label>Dose</Label>
                                  <Input
                                    value={updateForm.dose}
                                    onChange={(e) => setUpdateForm({ ...updateForm, dose: e.target.value })}
                                    placeholder="e.g., 325"
                                    data-testid="update-dose"
                                  />
                                </div>
                                <div>
                                  <Label>Route</Label>
                                  <Input
                                    value={updateForm.route}
                                    onChange={(e) => setUpdateForm({ ...updateForm, route: e.target.value })}
                                    placeholder="e.g., PO"
                                    data-testid="update-route"
                                  />
                                </div>
                              </div>
                            );
                          }
                          return (
                            <p className="text-sm text-slate-500">No additional fields required for this operation type.</p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Transfer Form */}
                {selectedOperation === 'transfer' && (
                  <div className="space-y-6">
                    {/* Patient Selection */}
                    <div>
                      <Label>Select Patient *</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search by MRN or name..."
                          className="pl-9"
                          data-testid="transfer-patient-search"
                        />
                      </div>
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                        {filteredPatients.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">No admitted patients found</p>
                        ) : (
                          filteredPatients.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handlePatientSelect(p)}
                              className={`w-full flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-slate-50 ${
                                selectedPatient?.id === p.id ? 'bg-blue-50' : ''
                              }`}
                              data-testid={`transfer-patient-${p.id}`}
                            >
                              <div>
                                <p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p>
                                <p className="text-xs text-slate-500">MRN: {p.mrn}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">{p.current_floor}-{p.current_room}-{p.current_bed}</Badge>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedPatient && (
                      <>
                        {/* Current Location */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                            <Bed className="w-4 h-4" />
                            Current Location
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-slate-500">Floor</Label>
                              <p className="font-medium">{transferForm.from_floor || 'N/A'}</p>
                            </div>
                            <div>
                              <Label className="text-slate-500">Room</Label>
                              <p className="font-medium">{transferForm.from_room || 'N/A'}</p>
                            </div>
                            <div>
                              <Label className="text-slate-500">Bed</Label>
                              <p className="font-medium">{transferForm.from_bed || 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Location Type */}
                        <div>
                          <Label>Transfer To</Label>
                          <RadioGroup
                            value={transferForm.location_type}
                            onValueChange={(v) => setTransferForm({ ...transferForm, location_type: v })}
                            className="mt-2"
                          >
                            {LOCATION_TYPES.map((lt) => (
                              <div key={lt.value} className="flex items-center space-x-2">
                                <RadioGroupItem value={lt.value} id={lt.value} data-testid={`location-type-${lt.value}`} />
                                <Label htmlFor={lt.value} className="cursor-pointer">{lt.label}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>

                        {/* Target Location */}
                        {transferForm.location_type !== 'unknown' && (
                          <div>
                            <h4 className="font-medium text-slate-900 mb-3">Target Location *</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label>Floor</Label>
                                <Input
                                  value={transferForm.to_floor}
                                  onChange={(e) => setTransferForm({ ...transferForm, to_floor: e.target.value })}
                                  placeholder={transferForm.location_type === 'or' ? 'OR' : 'e.g., 4'}
                                  data-testid="transfer-to-floor"
                                />
                              </div>
                              <div>
                                <Label>Room *</Label>
                                <Input
                                  value={transferForm.to_room}
                                  onChange={(e) => setTransferForm({ ...transferForm, to_room: e.target.value })}
                                  placeholder={transferForm.location_type === 'or' ? 'OR1' : 'e.g., 401'}
                                  data-testid="transfer-to-room"
                                />
                              </div>
                              <div>
                                <Label>Bed</Label>
                                <Input
                                  value={transferForm.to_bed}
                                  onChange={(e) => setTransferForm({ ...transferForm, to_bed: e.target.value })}
                                  placeholder="e.g., B"
                                  disabled={transferForm.location_type === 'or'}
                                  data-testid="transfer-to-bed"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Discharge Form */}
                {selectedOperation === 'discharge' && (
                  <div className="space-y-6">
                    {/* Patient Selection */}
                    <div>
                      <Label>Select Patient *</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search by MRN or name..."
                          className="pl-9"
                          data-testid="discharge-patient-search"
                        />
                      </div>
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                        {filteredPatients.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">No admitted patients found</p>
                        ) : (
                          filteredPatients.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handlePatientSelect(p)}
                              className={`w-full flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-slate-50 ${
                                selectedPatient?.id === p.id ? 'bg-blue-50' : ''
                              }`}
                              data-testid={`discharge-patient-${p.id}`}
                            >
                              <div>
                                <p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p>
                                <p className="text-xs text-slate-500">MRN: {p.mrn}</p>
                              </div>
                              <Badge variant="outline">{p.current_room || 'N/A'}</Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedPatient && (
                      <>
                        {/* Patient Info */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border">
                              <User className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {selectedPatient.first_name} {selectedPatient.last_name}
                              </p>
                              <p className="text-sm text-slate-500">
                                MRN: {selectedPatient.mrn} | Room: {selectedPatient.current_floor}-{selectedPatient.current_room}-{selectedPatient.current_bed}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Discharge Type */}
                        <div>
                          <Label>Discharge Type *</Label>
                          <RadioGroup
                            value={dischargeForm.discharge_type}
                            onValueChange={(v) => setDischargeForm({ ...dischargeForm, discharge_type: v })}
                            className="mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="immediate" id="immediate" data-testid="discharge-immediate" />
                              <Label htmlFor="immediate" className="cursor-pointer flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                Immediate Discharge
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="scheduled" id="scheduled" data-testid="discharge-scheduled" />
                              <Label htmlFor="scheduled" className="cursor-pointer flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Scheduled Discharge
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {dischargeForm.discharge_type === 'scheduled' && (
                          <div>
                            <Label>Scheduled Time *</Label>
                            <Input
                              type="datetime-local"
                              value={dischargeForm.scheduled_time}
                              onChange={(e) => setDischargeForm({ ...dischargeForm, scheduled_time: e.target.value })}
                              min={new Date().toISOString().slice(0, 16)}
                              className="mt-1"
                              data-testid="discharge-scheduled-time"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <div className="border-t pt-4 flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit() || submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]"
                    data-testid="submit-operation"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Processing...
                      </div>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Execute {selectedOperation ? selectedOperation.charAt(0).toUpperCase() + selectedOperation.slice(1) : ''}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={resultDialog.open} onOpenChange={(open) => setResultDialog({ open, data: null })}>
        <DialogContent className="max-w-lg" data-testid="result-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultDialog.data?.status === 'sent' || resultDialog.data?.status === 'scheduled' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              Operation {resultDialog.data?.status === 'sent' || resultDialog.data?.status === 'scheduled' ? 'Successful' : 'Failed'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {resultDialog.data?.status === 'scheduled' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800">
                  Discharge scheduled for {resultDialog.data.scheduled_at && format(new Date(resultDialog.data.scheduled_at), 'PPpp')}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-slate-500">Target URL</Label>
                  <p className="font-mono text-sm">{resultDialog.data?.target_url}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Response Code</Label>
                  <p className="font-mono">{resultDialog.data?.response_code || 'N/A'}</p>
                </div>
                {resultDialog.data?.message && (
                  <div>
                    <Label className="text-slate-500">HL7 Message</Label>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                      {resultDialog.data.message.split('\r').join('\n')}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepIndicator({ step, current, label, done }) {
  const isActive = step === current;
  const isPast = step < current || done;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
      isActive ? 'bg-blue-100 text-blue-700' : isPast ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
        isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
      }`}>
        {isPast ? <CheckCircle2 className="w-3 h-3" /> : step}
      </div>
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
    </div>
  );
}

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Server,
  Building2,
  FileText,
  User,
  Hash,
  Home,
  Layers,
  Send,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STEPS = [
  { id: 1, label: 'Scope Selection', icon: Server },
  { id: 2, label: 'Data Input', icon: User },
  { id: 3, label: 'Review & Send', icon: Send },
];

export default function SendMessage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [environments, setEnvironments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [selectedEnv, setSelectedEnv] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [mrn, setMrn] = useState('');
  const [visitNumber, setVisitNumber] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [floor, setFloor] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [envsRes, tenantsRes, templatesRes] = await Promise.all([
        axios.get(`${API}/environments`),
        axios.get(`${API}/tenants`),
        axios.get(`${API}/templates`),
      ]);
      setEnvironments(envsRes.data);
      setTenants(tenantsRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filtered data based on selections
  const filteredTenants = selectedEnv
    ? tenants.filter((t) => t.environment_id === selectedEnv)
    : [];

  const filteredTemplates = selectedTenant
    ? templates.filter((t) => t.tenant_id === selectedTenant)
    : [];

  // Get selected objects
  const selectedEnvObj = environments.find((e) => e.id === selectedEnv);
  const selectedTenantObj = tenants.find((t) => t.id === selectedTenant);
  const selectedTemplateObj = templates.find((t) => t.id === selectedTemplate);

  // Handle environment change - reset dependent fields
  const handleEnvChange = (value) => {
    setSelectedEnv(value);
    setSelectedTenant('');
    setSelectedTemplate('');
  };

  // Handle tenant change - reset template
  const handleTenantChange = (value) => {
    setSelectedTenant(value);
    setSelectedTemplate('');
  };

  // Generate preview message
  const generatePreviewMessage = () => {
    if (!selectedTemplateObj) return '';
    let message = selectedTemplateObj.body;
    message = message.replace(/\{\{MRN\}\}/g, mrn || '{{MRN}}');
    message = message.replace(/\{\{VISIT_NUMBER\}\}/g, visitNumber || '{{VISIT_NUMBER}}');
    message = message.replace(/\{\{ROOM\}\}/g, room || '{{ROOM}}');
    message = message.replace(/\{\{BED\}\}/g, bed || '{{BED}}');
    message = message.replace(/\{\{FLOOR\}\}/g, floor || '{{FLOOR}}');
    message = message.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14));
    message = message.replace(/\{\{MSG_ID\}\}/g, Math.random().toString(36).substring(2, 10).toUpperCase());
    return message;
  };

  // Validation
  const canProceedStep1 = selectedEnv && selectedTenant && selectedTemplate;
  const canProceedStep2 = mrn && visitNumber && room && bed && floor;

  // Navigation
  const goToStep = (step) => {
    if (step === 2 && !canProceedStep1) return;
    if (step === 3 && !canProceedStep2) return;
    setCurrentStep(step);
    if (step === 3) {
      setEditedMessage(generatePreviewMessage());
      setIsEditing(false);
    }
  };

  // Send message
  const handleSend = async () => {
    setSending(true);
    try {
      const response = await axios.post(`${API}/messages/send`, {
        environment_id: selectedEnv,
        tenant_id: selectedTenant,
        template_id: selectedTemplate,
        mrn,
        visit_number: visitNumber,
        room,
        bed,
        floor,
        edited_message: isEditing ? editedMessage : null,
      });
      setResult(response.data);
      toast.success(response.data.status === 'sent' ? 'Message sent successfully!' : 'Message sending failed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send message');
      setResult({ status: 'failed', response_body: error.response?.data?.detail });
    } finally {
      setSending(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setCurrentStep(1);
    setSelectedEnv('');
    setSelectedTenant('');
    setSelectedTemplate('');
    setMrn('');
    setVisitNumber('');
    setRoom('');
    setBed('');
    setFloor('');
    setEditedMessage('');
    setIsEditing(false);
    setResult(null);
  };

  // Highlight placeholders in preview
  const highlightPlaceholders = (text) => {
    return text.replace(/\{\{[^}]+\}\}/g, (match) => `<span class="placeholder-highlight">${match}</span>`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="send-message-page">
      {/* Stepper */}
      <Card className="border-0 shadow-sm">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`wizard-step cursor-pointer`}
                  onClick={() => goToStep(step.id)}
                  data-testid={`wizard-step-${step.id}`}
                >
                  <div
                    className={`wizard-step-circle ${
                      currentStep > step.id
                        ? 'completed'
                        : currentStep === step.id
                        ? 'active'
                        : 'pending'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`wizard-step-line ${
                      currentStep > step.id ? 'active' : 'pending'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {result ? (
        // Result View
        <Card data-testid="send-result">
          <CardContent className="py-12 text-center">
            {result.status === 'sent' ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Message Sent Successfully!</h2>
                <p className="text-slate-500 mb-6">
                  Your HL7 message has been delivered to {selectedEnvObj?.name} / {selectedTenantObj?.name}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Message Failed</h2>
                <p className="text-slate-500 mb-4">
                  {result.response_body || 'Failed to deliver the message'}
                </p>
              </>
            )}
            {result.target_url && (
              <p className="text-sm text-slate-400 mb-6">
                Target: {result.target_url}
              </p>
            )}
            <Button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="send-another-btn"
            >
              Send Another Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Step 1: Scope Selection */}
          {currentStep === 1 && (
            <Card data-testid="step-1">
              <CardHeader>
                <CardTitle className="text-xl">Select Message Scope</CardTitle>
                <p className="text-sm text-slate-500">
                  Choose the environment, tenant, and message template
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Environment */}
                <div className="space-y-2">
                  <Label className="text-slate-700 flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-400" />
                    Environment
                  </Label>
                  <Select value={selectedEnv} onValueChange={handleEnvChange}>
                    <SelectTrigger data-testid="env-select">
                      <SelectValue placeholder="Select an environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: env.color }}
                            />
                            {env.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEnvObj && (
                    <p className="text-xs text-slate-500">
                      Address: {selectedEnvObj.address}
                    </p>
                  )}
                </div>

                {/* Tenant */}
                <div className="space-y-2">
                  <Label className="text-slate-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Tenant
                  </Label>
                  <Select
                    value={selectedTenant}
                    onValueChange={handleTenantChange}
                    disabled={!selectedEnv}
                  >
                    <SelectTrigger data-testid="tenant-select">
                      <SelectValue placeholder={selectedEnv ? "Select a tenant" : "Select environment first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name} (Port: {tenant.port})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredTenants.length === 0 && selectedEnv && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      No tenants in this environment
                    </p>
                  )}
                </div>

                {/* Template */}
                <div className="space-y-2">
                  <Label className="text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Message Template
                  </Label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={setSelectedTemplate}
                    disabled={!selectedTenant}
                  >
                    <SelectTrigger data-testid="template-select">
                      <SelectValue placeholder={selectedTenant ? "Select a template" : "Select tenant first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredTemplates.length === 0 && selectedTenant && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      No templates for this tenant
                    </p>
                  )}
                </div>

                {/* Template Preview */}
                {selectedTemplateObj && (
                  <div className="space-y-2">
                    <Label className="text-slate-700">Template Preview</Label>
                    <pre
                      className="template-preview text-xs"
                      dangerouslySetInnerHTML={{
                        __html: highlightPlaceholders(selectedTemplateObj.body),
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Data Input */}
          {currentStep === 2 && (
            <Card data-testid="step-2">
              <CardHeader>
                <CardTitle className="text-xl">Enter Patient & Room Data</CardTitle>
                <p className="text-sm text-slate-500">
                  Provide the patient identifiers and room details to populate the message template.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Patient Information */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        Medical Record Number (MRN)
                      </Label>
                      <Input
                        value={mrn}
                        onChange={(e) => setMrn(e.target.value)}
                        placeholder="e.g., MRN-001234"
                        data-testid="mrn-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        Visit Number
                      </Label>
                      <Input
                        value={visitNumber}
                        onChange={(e) => setVisitNumber(e.target.value)}
                        placeholder="e.g., V-2026-0001"
                        data-testid="visit-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Details */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Room Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 flex items-center gap-2">
                        <Home className="w-4 h-4 text-slate-400" />
                        Room #
                      </Label>
                      <Input
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="e.g., 301"
                        data-testid="room-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 flex items-center gap-2">
                        <Home className="w-4 h-4 text-slate-400" />
                        Bed #
                      </Label>
                      <Input
                        value={bed}
                        onChange={(e) => setBed(e.target.value)}
                        placeholder="e.g., A"
                        data-testid="bed-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        Floor
                      </Label>
                      <Input
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        placeholder="e.g., 3"
                        data-testid="floor-input"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review & Send */}
          {currentStep === 3 && (
            <Card data-testid="step-3">
              <CardHeader>
                <CardTitle className="text-xl">Review & Send Message</CardTitle>
                <p className="text-sm text-slate-500">
                  Review your message and make any final edits before sending.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Environment</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: selectedEnvObj?.color }}
                      />
                      <span className="font-medium text-slate-900 text-sm">
                        {selectedEnvObj?.name}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Tenant</p>
                    <p className="font-medium text-slate-900 text-sm">
                      {selectedTenantObj?.name}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Template</p>
                    <p className="font-medium text-slate-900 text-sm">
                      {selectedTemplateObj?.name}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Target Port</p>
                    <p className="font-medium text-slate-900 text-sm">
                      {selectedTenantObj?.port}
                    </p>
                  </div>
                </div>

                {/* Patient Data Summary */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">MRN</p>
                    <p className="font-mono font-medium text-blue-900 text-sm">{mrn}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Visit #</p>
                    <p className="font-mono font-medium text-blue-900 text-sm">{visitNumber}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Room</p>
                    <p className="font-mono font-medium text-blue-900 text-sm">{room}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Bed</p>
                    <p className="font-mono font-medium text-blue-900 text-sm">{bed}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Floor</p>
                    <p className="font-mono font-medium text-blue-900 text-sm">{floor}</p>
                  </div>
                </div>

                {/* Message Preview / Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-700">Message Content</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-blue-600 hover:text-blue-700"
                      data-testid="edit-message-btn"
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      {isEditing ? 'Preview' : 'Edit'}
                    </Button>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                      data-testid="message-editor"
                    />
                  ) : (
                    <pre className="template-preview text-xs min-h-[200px]">
                      {editedMessage}
                    </pre>
                  )}
                  {isEditing && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      You are editing the message. Changes will be sent as-is.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 1}
              data-testid="back-btn"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={() => goToStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="next-btn"
              >
                {currentStep === 2 ? 'Review & Send' : 'Continue'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="send-btn"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

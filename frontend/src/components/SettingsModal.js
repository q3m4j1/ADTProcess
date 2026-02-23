import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import {
  Server,
  Building2,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = [
  '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#22C55E',
  '#84CC16', '#14B8A6',
];

const PLACEHOLDERS = [
  { label: 'MRN', value: '{{MRN}}' },
  { label: 'Visit Number', value: '{{VISIT_NUMBER}}' },
  { label: 'Room #', value: '{{ROOM}}' },
  { label: 'Bed #', value: '{{BED}}' },
  { label: 'Floor', value: '{{FLOOR}}' },
  { label: 'Timestamp', value: '{{TIMESTAMP}}' },
  { label: 'Message ID', value: '{{MSG_ID}}' },
];

export default function SettingsModal({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState('environments');
  const [environments, setEnvironments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Environment form
  const [envForm, setEnvForm] = useState({ name: '', address: '', color: COLORS[0] });
  const [editingEnv, setEditingEnv] = useState(null);

  // Tenant form
  const [tenantForm, setTenantForm] = useState({ name: '', environment_id: '', port: 18443 });
  const [editingTenant, setEditingTenant] = useState(null);
  const [expandedEnvs, setExpandedEnvs] = useState({});

  // Template form
  const [templateForm, setTemplateForm] = useState({ name: '', tenant_id: '', body: '' });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [filterEnvId, setFilterEnvId] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
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
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  // Environment handlers
  const handleSaveEnv = async () => {
    try {
      if (editingEnv) {
        await axios.put(`${API}/environments/${editingEnv.id}`, envForm);
        toast.success('Environment updated');
      } else {
        await axios.post(`${API}/environments`, envForm);
        toast.success('Environment created');
      }
      setEnvForm({ name: '', address: '', color: COLORS[0] });
      setEditingEnv(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save environment');
    }
  };

  const handleEditEnv = (env) => {
    setEditingEnv(env);
    setEnvForm({ name: env.name, address: env.address, color: env.color });
  };

  const handleDeleteEnv = async (id) => {
    if (!window.confirm('Delete this environment?')) return;
    try {
      await axios.delete(`${API}/environments/${id}`);
      toast.success('Environment deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete environment');
    }
  };

  // Tenant handlers
  const handleSaveTenant = async () => {
    try {
      if (editingTenant) {
        await axios.put(`${API}/tenants/${editingTenant.id}`, tenantForm);
        toast.success('Tenant updated');
      } else {
        await axios.post(`${API}/tenants`, tenantForm);
        toast.success('Tenant created');
      }
      setTenantForm({ name: '', environment_id: environments[0]?.id || '', port: 18443 });
      setEditingTenant(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save tenant');
    }
  };

  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setTenantForm({ name: tenant.name, environment_id: tenant.environment_id, port: tenant.port });
  };

  const handleDeleteTenant = async (id) => {
    if (!window.confirm('Delete this tenant?')) return;
    try {
      await axios.delete(`${API}/tenants/${id}`);
      toast.success('Tenant deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete tenant');
    }
  };

  // Template handlers
  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await axios.put(`${API}/templates/${editingTemplate.id}`, templateForm);
        toast.success('Template updated');
      } else {
        await axios.post(`${API}/templates`, templateForm);
        toast.success('Template created');
      }
      setTemplateForm({ name: '', tenant_id: '', body: '' });
      setEditingTemplate(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save template');
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({ name: template.name, tenant_id: template.tenant_id, body: template.body });
    // Set filters to show the template's tenant
    const tenant = tenants.find(t => t.id === template.tenant_id);
    if (tenant) {
      setFilterEnvId(tenant.environment_id);
      setFilterTenantId(template.tenant_id);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API}/templates/${id}`);
      toast.success('Template deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete template');
    }
  };

  const insertPlaceholder = (placeholder) => {
    setTemplateForm(prev => ({
      ...prev,
      body: prev.body + placeholder
    }));
  };

  const toggleEnvExpand = (envId) => {
    setExpandedEnvs(prev => ({ ...prev, [envId]: !prev[envId] }));
  };

  const getEnvTenants = (envId) => tenants.filter(t => t.environment_id === envId);
  const getTenantTemplates = (tenantId) => templates.filter(t => t.tenant_id === tenantId);
  const getEnvById = (id) => environments.find(e => e.id === id);
  const getTenantById = (id) => tenants.find(t => t.id === id);

  const filteredTenants = filterEnvId 
    ? tenants.filter(t => t.environment_id === filterEnvId)
    : tenants;

  const filteredTemplates = filterTenantId
    ? templates.filter(t => t.tenant_id === filterTenantId)
    : filterEnvId
    ? templates.filter(t => {
        const tenant = getTenantById(t.tenant_id);
        return tenant?.environment_id === filterEnvId;
      })
    : templates;

  const highlightPlaceholders = (text) => {
    return text.replace(/\{\{[^}]+\}\}/g, (match) => `<span class="placeholder-highlight">${match}</span>`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0" data-testid="settings-modal">
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="text-xl font-semibold text-slate-900">Configuration Settings</DialogTitle>
          <DialogDescription className="text-slate-500">
            Manage environments, tenants, and message templates
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 pt-4 border-b border-slate-100">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="environments" data-testid="tab-environments" className="gap-2">
                <Server className="w-4 h-4" />
                Environments
              </TabsTrigger>
              <TabsTrigger value="tenants" data-testid="tab-tenants" className="gap-2">
                <Building2 className="w-4 h-4" />
                Tenants
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates" className="gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh]">
            {/* Environments Tab */}
            <TabsContent value="environments" className="p-6 m-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Environments</h3>
                  <p className="text-sm text-slate-500">Manage deployment environments for message routing</p>
                </div>

                {/* Add/Edit Form */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-700">Environment Name</Label>
                      <Input
                        value={envForm.name}
                        onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
                        placeholder="e.g., Production"
                        className="mt-1"
                        data-testid="env-name-input"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700">Address (URL)</Label>
                      <Input
                        value={envForm.address}
                        onChange={(e) => setEnvForm({ ...envForm, address: e.target.value })}
                        placeholder="https://example.com:18443"
                        className="mt-1"
                        data-testid="env-address-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700">Color</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEnvForm({ ...envForm, color })}
                          className={`color-dot ${envForm.color === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          data-testid={`color-${color}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingEnv && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingEnv(null);
                          setEnvForm({ name: '', address: '', color: COLORS[0] });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveEnv}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!envForm.name || !envForm.address}
                      data-testid="save-env-btn"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {editingEnv ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </div>

                {/* Environments List */}
                <div className="space-y-2">
                  {environments.map((env) => (
                    <div
                      key={env.id}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      data-testid={`env-item-${env.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: env.color }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{env.name}</p>
                          <p className="text-sm text-slate-500">{env.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                          {getEnvTenants(env.id).length} tenants
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditEnv(env)}
                          data-testid={`edit-env-${env.id}`}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEnv(env.id)}
                          data-testid={`delete-env-${env.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {environments.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No environments yet</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tenants Tab */}
            <TabsContent value="tenants" className="p-6 m-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Tenants</h3>
                  <p className="text-sm text-slate-500">Manage tenants organized by environment</p>
                </div>

                {/* Add/Edit Form */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-700">Tenant Name</Label>
                      <Input
                        value={tenantForm.name}
                        onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                        placeholder="e.g., Hospital Alpha - Dev"
                        className="mt-1"
                        data-testid="tenant-name-input"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700">Parent Environment</Label>
                      <Select
                        value={tenantForm.environment_id}
                        onValueChange={(value) => setTenantForm({ ...tenantForm, environment_id: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="tenant-env-select">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          {environments.map((env) => (
                            <SelectItem key={env.id} value={env.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: env.color }} />
                                {env.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-700">Port</Label>
                      <Input
                        type="number"
                        value={tenantForm.port}
                        onChange={(e) => setTenantForm({ ...tenantForm, port: parseInt(e.target.value) || 18443 })}
                        placeholder="18443"
                        className="mt-1"
                        data-testid="tenant-port-input"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingTenant && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingTenant(null);
                          setTenantForm({ name: '', environment_id: '', port: 18443 });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveTenant}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!tenantForm.name || !tenantForm.environment_id}
                      data-testid="save-tenant-btn"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {editingTenant ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </div>

                {/* Tenants grouped by environment */}
                <div className="space-y-3">
                  {environments.map((env) => {
                    const envTenants = getEnvTenants(env.id);
                    const isExpanded = expandedEnvs[env.id] !== false;
                    return (
                      <div key={env.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleEnvExpand(env.id)}
                          className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
                          data-testid={`toggle-env-${env.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color }} />
                            <span className="font-medium text-slate-900">{env.name}</span>
                          </div>
                          <span className="text-sm text-slate-500">{envTenants.length} tenants</span>
                        </button>
                        {isExpanded && envTenants.length > 0 && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 space-y-2">
                            {envTenants.map((tenant) => (
                              <div
                                key={tenant.id}
                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200"
                                data-testid={`tenant-item-${tenant.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Building2 className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <p className="font-medium text-slate-900">{tenant.name}</p>
                                    <p className="text-xs text-slate-500">Port: {tenant.port}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                    {getTenantTemplates(tenant.id).length} templates
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditTenant(tenant)}
                                    data-testid={`edit-tenant-${tenant.id}`}
                                  >
                                    <Pencil className="w-4 h-4 text-slate-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteTenant(tenant.id)}
                                    data-testid={`delete-tenant-${tenant.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {isExpanded && envTenants.length === 0 && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
                            No tenants in this environment
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="p-6 m-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Message Templates</h3>
                  <p className="text-sm text-slate-500">Create and manage HL7 message templates with placeholders</p>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700">Filter by Environment</Label>
                    <Select value={filterEnvId} onValueChange={(v) => { setFilterEnvId(v); setFilterTenantId(''); }}>
                      <SelectTrigger className="mt-1" data-testid="filter-env-select">
                        <SelectValue placeholder="All environments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All environments</SelectItem>
                        {environments.map((env) => (
                          <SelectItem key={env.id} value={env.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: env.color }} />
                              {env.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700">Filter by Tenant</Label>
                    <Select value={filterTenantId} onValueChange={setFilterTenantId}>
                      <SelectTrigger className="mt-1" data-testid="filter-tenant-select">
                        <SelectValue placeholder="All tenants" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All tenants</SelectItem>
                        {filteredTenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Add/Edit Form */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-700">Template Name</Label>
                      <Input
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="e.g., ADT Transfer (A02)"
                        className="mt-1"
                        data-testid="template-name-input"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-700">Assign to Tenant</Label>
                      <Select
                        value={templateForm.tenant_id}
                        onValueChange={(value) => setTemplateForm({ ...templateForm, tenant_id: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="template-tenant-select">
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((tenant) => {
                            const env = getEnvById(tenant.environment_id);
                            return (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name} ({env?.name})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-700">Insert Placeholders</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => insertPlaceholder(p.value)}
                          className="placeholder-btn"
                          data-testid={`placeholder-${p.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-700">Template Body</Label>
                    <Textarea
                      value={templateForm.body}
                      onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                      placeholder="MSH|^~\&|SENDER|FAC|RECEIVER|FAC|{{TIMESTAMP}}||ADT^A01|{{MSG_ID}}|P|2.3..."
                      className="mt-1 font-mono text-sm min-h-[120px]"
                      data-testid="template-body-input"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    {editingTemplate && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingTemplate(null);
                          setTemplateForm({ name: '', tenant_id: '', body: '' });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveTemplate}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!templateForm.name || !templateForm.tenant_id || !templateForm.body}
                      data-testid="save-template-btn"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {editingTemplate ? 'Update Template' : 'Add Template'}
                    </Button>
                  </div>
                </div>

                {/* Templates List */}
                <div className="space-y-3">
                  {filteredTemplates.map((template) => {
                    const tenant = getTenantById(template.tenant_id);
                    const env = tenant ? getEnvById(tenant.environment_id) : null;
                    return (
                      <div
                        key={template.id}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                        data-testid={`template-item-${template.id}`}
                      >
                        <div className="flex items-center justify-between p-4 bg-white">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="font-medium text-slate-900">{template.name}</p>
                              <p className="text-xs text-slate-500">
                                {env && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: env.color }} />
                                    {env.name}
                                  </span>
                                )}
                                {tenant && ` / ${tenant.name}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTemplate(template)}
                              data-testid={`edit-template-${template.id}`}
                            >
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTemplate(template.id)}
                              data-testid={`delete-template-${template.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <div className="border-t border-slate-100">
                          <pre
                            className="template-preview text-xs"
                            dangerouslySetInnerHTML={{ __html: highlightPlaceholders(template.body) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {filteredTemplates.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No templates found</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

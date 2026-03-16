import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Activity,
  Server,
  Building2,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Zap,
  Search,
  Settings,
  BarChart3,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [reprocessing, setReprocessing] = useState({});
  const [viewMessageDialog, setViewMessageDialog] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState({});
  const [bulkReprocessing, setBulkReprocessing] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, envsRes, tenantsRes, templatesRes, logsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/environments`),
        axios.get(`${API}/tenants`),
        axios.get(`${API}/templates`),
        axios.get(`${API}/audit-logs?limit=100`),
      ]);
      setStats(statsRes.data);
      setEnvironments(envsRes.data);
      setTenants(tenantsRes.data);
      setTemplates(templatesRes.data);
      setAuditLogs(logsRes.data);
      setSelectedLogs({});
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate message volume chart data (last 7 days)
  const messageVolumeData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM dd'),
        fullDate: startOfDay(date).toISOString(),
        sent: 0,
        failed: 0,
      };
    });

    auditLogs.forEach((log) => {
      const logDate = startOfDay(parseISO(log.created_at)).toISOString();
      const dayData = last7Days.find((d) => d.fullDate === logDate);
      if (dayData) {
        if (log.status === 'sent') {
          dayData.sent += 1;
        } else {
          dayData.failed += 1;
        }
      }
    });

    return last7Days;
  }, [auditLogs]);

  // Generate environment distribution data
  const envDistributionData = useMemo(() => {
    const envCounts = {};
    auditLogs.forEach((log) => {
      envCounts[log.environment_name] = (envCounts[log.environment_name] || 0) + 1;
    });
    return Object.entries(envCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [auditLogs]);

  // Generate tenant activity data
  const tenantActivityData = useMemo(() => {
    const tenantCounts = {};
    auditLogs.forEach((log) => {
      tenantCounts[log.tenant_name] = (tenantCounts[log.tenant_name] || 0) + 1;
    });
    return Object.entries(tenantCounts)
      .map(([name, messages]) => ({ name, messages }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 5);
  }, [auditLogs]);

  const getEnvTenants = (envId) => tenants.filter((t) => t.environment_id === envId);
  const getEnvTemplates = (envId) => {
    const envTenantIds = getEnvTenants(envId).map((t) => t.id);
    return templates.filter((t) => envTenantIds.includes(t.tenant_id));
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.template_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleRowExpand = (logId) => {
    setExpandedRows((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const handleReprocess = async (logId) => {
    setReprocessing((prev) => ({ ...prev, [logId]: true }));
    try {
      const response = await axios.post(`${API}/audit-logs/${logId}/reprocess`);
      if (response.data.status === 'sent') {
        toast.success('Message reprocessed successfully!');
      } else {
        toast.error(`Reprocess failed: ${response.data.response_body || 'Unknown error'}`);
      }
      // Refresh audit logs and stats
      const [statsRes, logsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/audit-logs?limit=100`),
      ]);
      setStats(statsRes.data);
      setAuditLogs(logsRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reprocess message');
    } finally {
      setReprocessing((prev) => ({ ...prev, [logId]: false }));
    }
  };

  // Bulk selection handlers
  const selectedCount = Object.values(selectedLogs).filter(Boolean).length;
  const allSelected = filteredLogs.length > 0 && filteredLogs.slice(0, 50).every((log) => selectedLogs[log.id]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLogs({});
    } else {
      const newSelected = {};
      filteredLogs.slice(0, 50).forEach((log) => {
        newSelected[log.id] = true;
      });
      setSelectedLogs(newSelected);
    }
  };

  const toggleSelectLog = (logId) => {
    setSelectedLogs((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const handleBulkReprocess = async () => {
    const selectedIds = Object.entries(selectedLogs)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
    
    if (selectedIds.length === 0) return;

    setBulkReprocessing(true);
    try {
      const response = await axios.post(`${API}/audit-logs/bulk-reprocess`, {
        audit_ids: selectedIds,
      });
      
      const { successful, failed, total } = response.data;
      
      if (successful > 0 && failed === 0) {
        toast.success(`Successfully reprocessed ${successful} message(s)`);
      } else if (successful > 0 && failed > 0) {
        toast.warning(`Reprocessed ${successful} of ${total} messages. ${failed} failed.`);
      } else {
        toast.error(`Failed to reprocess ${failed} message(s)`);
      }
      
      // Refresh data
      const [statsRes, logsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/audit-logs?limit=100`),
      ]);
      setStats(statsRes.data);
      setAuditLogs(logsRes.data);
      setSelectedLogs({});
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to bulk reprocess messages');
    } finally {
      setBulkReprocessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard">
      {/* Hero Section */}
      <div className="hero-gradient rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-200 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">System Health</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">MsgRouter Platform</h1>
          <p className="text-blue-100 max-w-lg mb-6">
            Enterprise HL7 message routing platform. Configure environments, manage tenants, and
            send templated messages across your healthcare infrastructure.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/send')}
              className="bg-white text-blue-600 hover:bg-blue-50"
              data-testid="hero-send-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() =>
                  document.querySelector('[data-testid="settings-btn"]')?.click()
                }
                data-testid="hero-configure-btn"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card-blue border" data-testid="stat-environments">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">ENVIRONMENTS</span>
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-blue-700">{stats?.environments_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="stat-card-green border" data-testid="stat-tenants">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">TENANTS</span>
              <Building2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-700">{stats?.tenants_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="stat-card-purple border" data-testid="stat-templates">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">TEMPLATES</span>
              <FileText className="w-5 h-5 text-violet-500" />
            </div>
            <p className="text-3xl font-bold text-violet-700">{stats?.templates_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="stat-card-amber border" data-testid="stat-messages">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">MESSAGES SENT</span>
              <Send className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-amber-700">{stats?.messages_sent || 0}</p>
          </CardContent>
        </Card>

        <Card className="border" data-testid="stat-successful">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">SUCCESSFUL</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats?.successful || 0}</p>
          </CardContent>
        </Card>

        <Card className="stat-card-red border" data-testid="stat-failed">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">FAILED</span>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats?.failed || 0}</p>
          </CardContent>
        </Card>

        <Card className="border" data-testid="stat-success-rate">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">SUCCESS RATE</span>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats?.success_rate || 100}%</p>
          </CardContent>
        </Card>

        <Card className="border" data-testid="stat-status">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">SYSTEM STATUS</span>
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">Online</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Volume Chart */}
        <Card data-testid="message-volume-chart">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-lg">Message Volume (Last 7 Days)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messageVolumeData}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="#2563EB"
                    fillOpacity={1}
                    fill="url(#colorSent)"
                    strokeWidth={2}
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="#EF4444"
                    fillOpacity={1}
                    fill="url(#colorFailed)"
                    strokeWidth={2}
                    name="Failed"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Environment Distribution */}
        <Card data-testid="env-distribution-chart">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-lg">Messages by Environment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {envDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={envDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      {envDistributionData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  No message data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tenant Activity */}
        <Card data-testid="tenant-activity-chart">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-500" />
              <CardTitle className="text-lg">Top Tenants by Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {tenantActivityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenantActivityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="messages" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  No tenant activity yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Overview */}
        <Card data-testid="quick-overview">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg">Quick Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {environments.slice(0, 4).map((env) => (
                <div
                  key={env.id}
                  className="bg-slate-50 rounded-lg p-4 border border-slate-100 hover:shadow-sm transition-shadow"
                  data-testid={`overview-env-${env.id}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: env.color }}
                    />
                    <span className="font-medium text-slate-900">{env.name}</span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{getEnvTenants(env.id).length} tenants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{getEnvTemplates(env.id).length} templates</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {environments.length > 4 && (
              <p className="text-center text-sm text-slate-500 mt-4">
                + {environments.length - 4} more environments
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit Trail */}
      <Card data-testid="audit-trail">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-lg">Audit Trail</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length} entries
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <Button
                  onClick={handleBulkReprocess}
                  disabled={bulkReprocessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="bulk-reprocess-btn"
                >
                  {bulkReprocessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reprocess {selectedCount} selected
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search MRN, tenant, template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="audit-search"
                />
              </div>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32" data-testid="audit-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-10 p-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                    </th>
                    <th className="w-10 p-3"></th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Timestamp
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Environment
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Tenant
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Template
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      MRN
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, 50).map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${selectedLogs[log.id] ? 'bg-blue-50/50' : ''}`}
                        data-testid={`audit-row-${log.id}`}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedLogs[log.id] || false}
                            onCheckedChange={() => toggleSelectLog(log.id)}
                            data-testid={`select-log-${log.id}`}
                          />
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleRowExpand(log.id)}
                            data-testid={`expand-row-${log.id}`}
                          >
                            {expandedRows[log.id] ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </Button>
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {format(new Date(log.created_at), 'MMM dd, yyyy, hh:mm:ss a')}
                        </td>
                        <td className="p-3 text-sm font-medium text-slate-900">
                          {log.environment_name}
                        </td>
                        <td className="p-3 text-sm text-slate-600">{log.tenant_name}</td>
                        <td className="p-3 text-sm text-slate-600">{log.template_name}</td>
                        <td className="p-3 text-sm font-mono text-slate-600">{log.mrn}</td>
                        <td className="p-3">
                          <Badge
                            className={
                              log.status === 'sent' ? 'status-sent' : 'status-failed'
                            }
                          >
                            {log.status === 'sent' ? (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.status === 'sent' ? 'Sent' : 'Failed'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => setViewMessageDialog(log)}
                              data-testid={`view-message-${log.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleReprocess(log.id)}
                              disabled={reprocessing[log.id]}
                              data-testid={`reprocess-${log.id}`}
                            >
                              {reprocessing[log.id] ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600 mr-1" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-1" />
                              )}
                              Reprocess
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedRows[log.id] && (
                        <tr key={`${log.id}-details`} className="bg-slate-50">
                          <td colSpan={9} className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Visit Number</p>
                                <p className="text-sm font-mono text-slate-700">{log.visit_number}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Response Code</p>
                                <p className="text-sm font-mono text-slate-700">{log.response_code || 'N/A'}</p>
                              </div>
                              {log.response_body && (
                                <div className="col-span-2">
                                  <p className="text-xs font-semibold text-slate-500 mb-1">Response</p>
                                  <p className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                                    {log.response_body}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No audit logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Message Dialog */}
      <Dialog open={!!viewMessageDialog} onOpenChange={() => setViewMessageDialog(null)}>
        <DialogContent className="max-w-3xl" data-testid="view-message-dialog">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
            <DialogDescription>
              {viewMessageDialog?.template_name} - {viewMessageDialog?.environment_name} / {viewMessageDialog?.tenant_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">MRN</p>
                <p className="font-mono font-medium">{viewMessageDialog?.mrn}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Visit Number</p>
                <p className="font-mono font-medium">{viewMessageDialog?.visit_number}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <Badge className={viewMessageDialog?.status === 'sent' ? 'status-sent' : 'status-failed'}>
                  {viewMessageDialog?.status === 'sent' ? 'Sent' : 'Failed'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Message Content</p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {viewMessageDialog?.message_sent}
              </pre>
            </div>
            {viewMessageDialog?.response_body && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Response ({viewMessageDialog?.response_code || 'N/A'})</p>
                <div className="bg-slate-100 p-3 rounded-lg text-sm">
                  {viewMessageDialog?.response_body}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMessageDialog(null)}>
              Close
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                handleReprocess(viewMessageDialog.id);
                setViewMessageDialog(null);
              }}
              data-testid="reprocess-from-dialog"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reprocess Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

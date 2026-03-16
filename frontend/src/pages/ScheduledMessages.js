import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Clock,
  Calendar,
  Server,
  Building2,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ScheduledMessages() {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-messages`);
      setScheduled(response.data);
    } catch (error) {
      toast.error('Failed to fetch scheduled messages');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/scheduled-messages/process`);
      const { processed, results } = response.data;
      
      if (processed > 0) {
        const successful = results.filter(r => r.status === 'sent').length;
        const failed = results.filter(r => r.status !== 'sent').length;
        
        if (successful > 0 && failed === 0) {
          toast.success(`Processed ${successful} message(s) successfully`);
        } else if (successful > 0) {
          toast.warning(`Processed ${successful} message(s), ${failed} failed`);
        } else {
          toast.error(`All ${failed} message(s) failed`);
        }
      } else {
        toast.info('No messages due for processing');
      }
      
      fetchScheduled();
    } catch (error) {
      toast.error('Failed to process scheduled messages');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!messageToDelete) return;
    
    try {
      await axios.delete(`${API}/scheduled-messages/${messageToDelete.id}`);
      toast.success('Scheduled message cancelled');
      fetchScheduled();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel message');
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const openDeleteDialog = (message) => {
    setMessageToDelete(message);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-slate-100 text-slate-700"><AlertCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = scheduled.filter(s => s.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="scheduled-messages-page">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Scheduled Messages
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                View and manage messages scheduled for future delivery
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-sm py-1.5">
                  {pendingCount} pending
                </Badge>
              )}
              <Button
                onClick={handleProcessNow}
                disabled={processing || pendingCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="process-now-btn"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Process Due Messages
              </Button>
              <Button
                variant="outline"
                onClick={fetchScheduled}
                data-testid="refresh-btn"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {scheduled.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">No scheduled messages</p>
                <p className="text-sm">Messages scheduled for later delivery will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduled.map((message) => (
                  <div
                    key={message.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50/50 transition-colors"
                    data-testid={`scheduled-message-${message.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(message.status)}
                          <span className="text-sm text-slate-500">
                            Scheduled for{' '}
                            <span className="font-medium text-slate-700">
                              {format(new Date(message.scheduled_at), 'MMM dd, yyyy \'at\' hh:mm a')}
                            </span>
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900 mb-2">{message.template_name}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Server className="w-4 h-4 text-slate-400" />
                            <span>{message.environment_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span>{message.tenant_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">MRN:</span>{' '}
                            <span className="font-mono">{message.mrn}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Visit:</span>{' '}
                            <span className="font-mono">{message.visit_number}</span>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-400">
                          Created {format(new Date(message.created_at), 'MMM dd, yyyy \'at\' hh:mm a')} by {message.user_email}
                        </div>
                      </div>
                      {message.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(message)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          data-testid={`cancel-scheduled-${message.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="cancel-scheduled-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this scheduled message?
              <br />
              <span className="font-medium">{messageToDelete?.template_name}</span> scheduled for{' '}
              {messageToDelete && format(new Date(messageToDelete.scheduled_at), 'MMM dd, yyyy \'at\' hh:mm a')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-cancel-btn"
            >
              Cancel Message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

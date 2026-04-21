import { useState } from "react";
import { useListLeaves, useCreateLeave, useUpdateLeave, useDeleteLeave, useListEmployees, LeaveRequest, CreateLeaveBodyLeaveType } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, XCircle, Trash2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListLeavesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, differenceInDays } from "date-fns";

const leaveSchema = z.object({
  employeeId: z.coerce.number().min(1, "Employee is required"),
  leaveType: z.enum(["annual", "sick", "maternity", "paternity", "unpaid"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

const reviewSchema = z.object({
  reviewNote: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

export default function Leaves() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<{leave: LeaveRequest, action: 'approved' | 'rejected'} | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | "all">("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const canManage = user?.role === 'admin' || user?.role === 'hr_manager';
  
  // Default to user's own ID if they are just an employee
  const queryEmployeeId = canManage 
    ? (filterEmployeeId !== "all" ? filterEmployeeId : undefined) 
    : user?.id;

  const { data: employees } = useListEmployees({}, { query: { enabled: canManage } });
  
  const { data: leaveRecords, isLoading } = useListLeaves({
    status: filterStatus !== "all" ? filterStatus as any : undefined,
    employeeId: queryEmployeeId,
  });

  const createMutation = useCreateLeave();
  const updateMutation = useUpdateLeave();
  const deleteMutation = useDeleteLeave();

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      employeeId: canManage ? 0 : (user?.id || 0),
      leaveType: "annual",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      reason: "",
    }
  });

  const reviewForm = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      reviewNote: "",
    }
  });

  const openCreateDialog = () => {
    form.reset({
      employeeId: canManage ? 0 : (user?.id || 0),
      leaveType: "annual",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      reason: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: LeaveFormValues) => {
    try {
      if (!canManage && user?.id) {
        data.employeeId = user.id;
      }
      
      if (new Date(data.endDate) < new Date(data.startDate)) {
        toast({ title: "Validation Error", description: "End date cannot be before start date", variant: "destructive" });
        return;
      }

      await createMutation.mutateAsync({
        data: {
          employeeId: data.employeeId,
          leaveType: data.leaveType as CreateLeaveBodyLeaveType,
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason || null,
        }
      });
      toast({ title: "Leave request submitted successfully" });
      queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleReviewSubmit = async (data: ReviewFormValues) => {
    if (!reviewingLeave) return;
    
    try {
      await updateMutation.mutateAsync({
        id: reviewingLeave.leave.id,
        data: {
          status: reviewingLeave.action,
          reviewNote: data.reviewNote || null,
        }
      });
      toast({ title: `Leave request ${reviewingLeave.action}` });
      queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      setReviewingLeave(null);
      reviewForm.reset();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this leave request?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: "Leave request deleted successfully" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaves</h1>
          <p className="text-muted-foreground">Manage time off requests</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> Request Leave</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
              <DialogDescription>
                Fill out the details for your time off request.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {canManage && (
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees?.map(e => (
                              <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Annual Leave</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="maternity">Maternity Leave</SelectItem>
                          <SelectItem value="paternity">Paternity Leave</SelectItem>
                          <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="Details about this request..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewingLeave} onOpenChange={(open) => !open && setReviewingLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewingLeave?.action === 'approved' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
            <DialogDescription>
              {reviewingLeave?.leave.employeeName}'s {reviewingLeave?.leave.leaveType} leave from {reviewingLeave?.leave.startDate && format(new Date(reviewingLeave.leave.startDate), "MMM d")} to {reviewingLeave?.leave.endDate && format(new Date(reviewingLeave.leave.endDate), "MMM d")}.
            </DialogDescription>
          </DialogHeader>
          <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit(handleReviewSubmit)} className="space-y-4">
              <FormField
                control={reviewForm.control}
                name="reviewNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add a note to this decision..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReviewingLeave(null)}>Cancel</Button>
                <Button 
                  type="submit" 
                  variant={reviewingLeave?.action === 'approved' ? 'default' : 'destructive'}
                  className={reviewingLeave?.action === 'approved' ? 'bg-primary hover:bg-primary/90' : ''}
                >
                  Confirm {reviewingLeave?.action === 'approved' ? 'Approval' : 'Rejection'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 w-full sm:w-auto text-sm text-muted-foreground mr-2">
              <Filter className="h-4 w-4" /> Filters:
            </div>
            
            <Select 
              value={filterStatus} 
              onValueChange={setFilterStatus}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {canManage && (
              <Select 
                value={filterEmployeeId.toString()} 
                onValueChange={(val) => setFilterEmployeeId(val === "all" ? "all" : parseInt(val))}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {(filterStatus !== "all" || filterEmployeeId !== "all") && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setFilterStatus("all");
                  setFilterEmployeeId("all");
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Employee</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center py-8">Loading requests...</TableCell></TableRow>
                ) : leaveRecords?.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center py-8">No leave requests found.</TableCell></TableRow>
                ) : (
                  leaveRecords?.map((leave) => {
                    const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
                    return (
                      <TableRow key={leave.id}>
                        {canManage && <TableCell className="font-medium">{leave.employeeName}</TableCell>}
                        <TableCell className="capitalize">{leave.leaveType}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(leave.startDate), "MMM d, yyyy")} - <br/>
                          {format(new Date(leave.endDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{days} day{days !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={leave.reason || ""}>
                          {leave.reason || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}
                            className={leave.status === 'approved' ? 'bg-primary' : ''}
                          >
                            {leave.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canManage && leave.status === 'pending' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-primary hover:text-primary hover:bg-primary/10" 
                                  onClick={() => setReviewingLeave({ leave, action: 'approved' })}
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                                  onClick={() => setReviewingLeave({ leave, action: 'rejected' })}
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(canManage || leave.employeeId === user?.id) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                                onClick={() => handleDelete(leave.id)} 
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

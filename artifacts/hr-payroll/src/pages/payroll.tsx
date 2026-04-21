import { useState, useMemo } from "react";
import { useListPayroll, useCreatePayroll, useUpdatePayroll, useDeletePayroll, useListEmployees, Payroll, CreatePayrollBodyStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileEdit, Trash2, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getListPayrollQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

const payrollSchema = z.object({
  id: z.number().optional(),
  employeeId: z.coerce.number().min(1, "Employee is required"),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  basicSalary: z.coerce.number().min(0),
  bonuses: z.coerce.number().min(0),
  deductions: z.coerce.number().min(0),
  status: z.enum(["pending", "processed", "paid"]),
});

type PayrollFormValues = z.infer<typeof payrollSchema>;

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function PayrollPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  
  // Filters
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | "all">("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'hr_manager';

  const { data: employees } = useListEmployees();
  
  const { data: payrollRecords, isLoading } = useListPayroll({
    month: filterMonth !== "all" ? filterMonth : undefined,
    year: filterYear !== "all" ? filterYear : undefined,
    employeeId: filterEmployeeId !== "all" ? filterEmployeeId : undefined,
  });

  const createMutation = useCreatePayroll();
  const updateMutation = useUpdatePayroll();
  const deleteMutation = useDeletePayroll();

  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      basicSalary: 0,
      bonuses: 0,
      deductions: 0,
      status: "pending",
    }
  });

  const watchBasicSalary = form.watch("basicSalary");
  const watchBonuses = form.watch("bonuses");
  const watchDeductions = form.watch("deductions");

  const calculatedNetSalary = useMemo(() => {
    const basic = Number(watchBasicSalary) || 0;
    const bonus = Number(watchBonuses) || 0;
    const ded = Number(watchDeductions) || 0;
    return basic + bonus - ded;
  }, [watchBasicSalary, watchBonuses, watchDeductions]);

  // Pre-fill basic salary when employee is selected
  const watchEmployeeId = form.watch("employeeId");
  useMemo(() => {
    if (watchEmployeeId && !editingPayroll) {
      const emp = employees?.find(e => e.id === Number(watchEmployeeId));
      if (emp) {
        form.setValue("basicSalary", emp.salary);
      }
    }
  }, [watchEmployeeId, employees, form, editingPayroll]);

  const openCreateDialog = () => {
    setEditingPayroll(null);
    form.reset({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      basicSalary: 0,
      bonuses: 0,
      deductions: 0,
      status: "pending",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: Payroll) => {
    setEditingPayroll(record);
    form.reset({
      id: record.id,
      employeeId: record.employeeId,
      month: record.month,
      year: record.year,
      basicSalary: record.basicSalary,
      bonuses: record.bonuses,
      deductions: record.deductions,
      status: record.status,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: PayrollFormValues) => {
    try {
      if (editingPayroll && data.id) {
        await updateMutation.mutateAsync({
          id: data.id,
          data: {
            employeeId: data.employeeId,
            month: data.month,
            year: data.year,
            basicSalary: data.basicSalary,
            bonuses: data.bonuses,
            deductions: data.deductions,
            status: data.status,
          }
        });
        toast({ title: "Payroll record updated successfully" });
      } else {
        await createMutation.mutateAsync({
          data: {
            employeeId: data.employeeId,
            month: data.month,
            year: data.year,
            basicSalary: data.basicSalary,
            bonuses: data.bonuses,
            deductions: data.deductions,
            status: data.status as CreatePayrollBodyStatus,
          }
        });
        toast({ title: "Payroll record created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListPayrollQueryKey() });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this payroll record?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListPayrollQueryKey() });
        toast({ title: "Payroll record deleted successfully" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Manage salary processing and history</p>
        </div>
        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> Process Payroll</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingPayroll ? "Edit Payroll Record" : "Process New Payroll"}</DialogTitle>
                <DialogDescription>
                  Enter salary details. Net salary will be calculated automatically.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>Employee</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees?.map(e => (
                                <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName} ({e.position})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Month" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map(m => (
                                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {years.map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="basicSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Basic Salary</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bonuses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bonuses</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deductions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deductions</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processed">Processed</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg flex justify-between items-center border border-border">
                    <span className="font-semibold text-sm">Calculated Net Salary:</span>
                    <span className="text-xl font-bold text-primary">${calculatedNetSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Saving..." : "Save Record"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 w-full sm:w-auto text-sm text-muted-foreground mr-2">
              <Filter className="h-4 w-4" /> Filters:
            </div>
            
            <Select 
              value={filterMonth.toString()} 
              onValueChange={(val) => setFilterMonth(val === "all" ? "all" : parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filterYear.toString()} 
              onValueChange={(val) => setFilterYear(val === "all" ? "all" : parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
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
            
            {(filterMonth !== "all" || filterYear !== "all" || filterEmployeeId !== "all") && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setFilterMonth("all");
                  setFilterYear("all");
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
                  <TableHead>Period</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Bonuses</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center py-8">Loading records...</TableCell></TableRow>
                ) : payrollRecords?.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center py-8">No payroll records found for selected filters.</TableCell></TableRow>
                ) : (
                  payrollRecords?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {months.find(m => m.value === record.month)?.label.substring(0, 3)} {record.year}
                      </TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell className="text-right">${record.basicSalary.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">+${record.bonuses.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">-${record.deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-primary">${record.netSalary.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={record.status === 'paid' ? 'default' : record.status === 'processed' ? 'secondary' : 'outline'}
                          className={record.status === 'paid' ? 'bg-primary' : ''}
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)} title="Edit">
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(record.id)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

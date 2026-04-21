import { useState, useRef } from "react";
import { useGetEmployee, useUploadEmployeePhoto, useListPayroll } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { User, Mail, Phone, Briefcase, Building2, Calendar, DollarSign, MapPin, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeDetail({ id }: { id: number }) {
  const { data: employee, isLoading } = useGetEmployee(id, { query: { enabled: !!id } });
  const { data: payrollHistory, isLoading: isLoadingPayroll } = useListPayroll({ employeeId: id }, { query: { enabled: !!id } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'hr_manager';
  
  const uploadMutation = useUploadEmployeePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate upload - in a real app this would upload to S3/storage and get a URL
    // For this mockup, we'll just generate a deterministic avatar URL
    try {
      const fakePhotoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${employee?.email}`;
      await uploadMutation.mutateAsync({
        id,
        data: { photoUrl: fakePhotoUrl }
      });
      queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id) });
      toast({ title: "Photo updated successfully" });
    } catch (err: any) {
      toast({ title: "Failed to upload photo", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div>Loading employee details...</div>;
  }

  if (!employee) {
    return <div>Employee not found</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-background shadow-sm">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="h-full w-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          {canManage && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Upload className="h-6 w-6 text-white" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{employee.firstName} {employee.lastName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">{employee.position}</span>
            <span>•</span>
            <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>{employee.status}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Employee Details</TabsTrigger>
          <TabsTrigger value="payroll">Payroll History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.phone || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.address || "Not provided"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Position</span>
                    <span>{employee.position}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <span>{employee.departmentName || "Unassigned"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Hire Date</span>
                    <span>{format(new Date(employee.hireDate), "MMMM d, yyyy")}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Base Salary</span>
                      <span>${employee.salary.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Records</CardTitle>
              <CardDescription>Historical payroll data for this employee</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Bonuses</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right font-bold">Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPayroll ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>
                  ) : payrollHistory?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-4">No payroll records found.</TableCell></TableRow>
                  ) : (
                    payrollHistory?.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.month}/{record.year}</TableCell>
                        <TableCell className="text-right">${record.basicSalary.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">+${record.bonuses.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">-${record.deductions.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">${record.netSalary.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={record.status === 'paid' ? 'default' : 'outline'}>{record.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
